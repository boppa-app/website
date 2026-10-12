---
title: Playback
description: How a media source hands Boppa a stream to play, from a plain URL to bytes it serves itself.
nav: Playback
order: 16
category: Media Sources
---

# Playback

A media source plays media in one of two ways:

- **From the container.** The container registers a `resolve` handler that turns a track into a stream, and Boppa plays it natively. This is the default, and it gets lock screen controls and Now Playing info without any extra work.
- **From a [player page](/docs/media-sources/playback/player-page).** A web page, loaded in a hidden WebView, plays the media itself and Boppa drives it through a JavaScript bridge. Use this only when the site's media can't be reached any other way.

A package uses a player page when it includes `playback/index.html` or sets `url` in `playback/config.json`. Otherwise it plays from the container.

## `resolve`

```js
boppa.playback.register({
  resolve: async function (track, { signal }) {
    const info = await fetchStreamInfo(track.id, signal)
    return { kind: "direct", url: info.url }
  },
})
```

Boppa calls `resolve` once each time a track starts. It receives:

- **`track`**: the track being played.

  ```js
  {
    id: "unique-id", // the track's id from a search, list, or get handler
    title: "Track Title",
    subtitle: "Artist Name", // "" if unknown
    duration: 213000, // milliseconds, 0 if unknown
    lowResArtworkUrl: "https://...", // "" if unknown
    highResArtworkUrl: "https://...", // "" if unknown
    url: "https://...", // "" if unknown
    metadata: { any: "JSON object" }, // {} if none
  }
  ```

  `metadata` is carried through unchanged from whichever handler produced the track, see [Result shape](/docs/media-sources/search#result-shape).

- **`{ signal }`**: an `AbortSignal` that fires when the stream is released, for example because the user skipped to another track before `resolve` finished.

`resolve` returns a **stream descriptor**, an object describing how Boppa should get the media. Its `kind` picks one of three shapes, from least to most control:

| `kind` | Who fetches the bytes | Use it when |
| --- | --- | --- |
| `direct` | Boppa, from a URL. | The media is at a URL anyone can request. |
| `progressive` | The container, one byte range at a time. | The bytes need custom requests, headers, or decoding. |
| `fragmented` | The container, one fragment at a time. | The media is fragmented MP4 or packed audio, and seeking and duration must be exact. |

`resolve` has up to 10 minutes to settle. A thrown error stops the track and shows the error's message.

## Stream descriptors

### `direct`

```js
return {
  kind: "direct",
  url: "https://cdn.example.com/track.mp3", // required
  duration: 213.4, // optional, seconds
  bufferAheadSeconds: 30, // optional
}
```

Boppa plays `url` itself. No cookies or custom headers are sent, so the URL must work on its own. If the stream fails mid-track, Boppa calls `resolve` once more and resumes from the same position.

### `progressive`

```js
return {
  kind: "progressive",
  mimeType: "audio/mp4", // required
  contentLength: 4821733, // required, total bytes
  duration: 213.4, // optional, seconds
  bufferAheadSeconds: 30, // optional
  chunkBytes: 65536, // optional
  handle: { url: info.url, key: info.key }, // optional
}
```

Boppa treats the media as one file of `contentLength` bytes and asks the container for whatever byte ranges the player needs, through the [stream handlers](#stream-handlers).

### `fragmented`

```js
return {
  kind: "fragmented",
  mimeType: "audio/mp4", // required
  fragments: [ // required, non-empty
    { offset: 1024, length: 98304, duration: 2.0 },
    { offset: 99328, length: 97280, duration: 2.0 },
  ],
  initSegment: { offset: 0, length: 1024 }, // fragmented MP4 only
  duration: 213.4, // optional, seconds
  bufferAheadSeconds: 30, // optional
  chunkBytes: 65536, // optional
  handle: { /* ... */ }, // optional
}
```

`fragments` maps the media's timeline. Each fragment is a byte range (`offset` and `length`) and how long it plays (`duration`, in seconds). Boppa uses the map to seek straight to the fragment it needs and to show an exact duration, then asks the container for each fragment's bytes through the [stream handlers](#stream-handlers).

`initSegment` is the byte range of a fragmented MP4's initialization segment (its `ftyp` and `moov` boxes). Leave it out for packed audio such as MP3 or ADTS AAC, where every fragment carries its own headers.

### Common fields

| Field | Description |
| --- | --- |
| `duration` | The track's length in seconds. When set, Boppa trusts it over what it reads from the media. |
| `bufferAheadSeconds` | How many seconds Boppa should buffer ahead of the playhead. When omitted, the system decides, which can mean downloading a whole small file. |
| `chunkBytes` | The most bytes Boppa asks for in a single `pull`. Defaults to `65536`. |
| `handle` | Any value. Boppa keeps it and passes it back to every stream handler for this stream. Use it to carry whatever the stream handlers need, such as a signed URL or a decryption key. |

An invalid descriptor, for example a `progressive` stream without `contentLength`, stops the track with a message naming the missing field.

## Stream handlers

`progressive` and `fragmented` streams are served by the container. Boppa reads them through four more playback handlers:

```js
boppa.playback.register({
  openStream: async function (handle, { offset }) {
    // start reading at byte offset
    return { streamId: "s1" }
  },
  pull: async function (handle, { streamId, maxBytes }) {
    // hand over up to maxBytes bytes
    return { bytes: chunk, eof: false }
  },
  closeStream: async function (handle, { streamId }) {
    // stop reading and free what this read held
  },
  release: async function (handle) {
    // the track is done, free everything for this stream
  },
})
```

| Handler | Called when | Returns |
| --- | --- | --- |
| `openStream(handle, { offset })` | Boppa needs bytes starting at `offset`, for a byte range or a fragment. | `{ streamId }`, a string naming this read. |
| `pull(handle, { streamId, maxBytes })` | Boppa wants the next bytes of a read. Called repeatedly until the range is filled. | `{ bytes, eof, waiting }` |
| `closeStream(handle, { streamId })` | A read is finished or abandoned. | Nothing. |
| `release(handle)` | The track stopped, ended, or was replaced. | Nothing. |

Several reads of the same stream can be open at once, for example when the user seeks. `streamId` tells them apart.

`pull` returns:

| Field | Description |
| --- | --- |
| `bytes` | The next bytes, in order, as an array of byte values or a typed array such as `Uint8Array`. Return at most `maxBytes`. May be empty. |
| `eof` | `true` once the media has no more bytes. |
| `waiting` | `true` when `bytes` is empty because the container is deliberately waiting, for example riding out a network outage. |

An empty `pull` with `waiting: true` tells Boppa to keep asking. It gives up only after 10 minutes without bytes. An empty `pull` without `waiting` is treated as stuck, and after about 2 seconds of them Boppa fails that read and retries it. A thrown error fails the read the same way.

### Giving up on a track

Boppa retries failed reads on its own, so an error from `openStream` or `pull` is normally treated as temporary. When the container knows retrying won't help, for example because the track was taken down, it can mark the error as fatal:

```js
const error = new Error("This track is no longer available")
error.fatal = true
throw error
```

Prefixing the message with `non-retryable:` works the same way. Boppa then stops the track and shows the message, without the prefix.

## Now Playing

Boppa fills the lock screen and Control Center from the track's title, subtitle, and artwork, and handles play, pause, seek, and skip itself. A container-played source needs nothing more. Player pages work differently, see [iOS](/docs/media-sources/playback/ios).
