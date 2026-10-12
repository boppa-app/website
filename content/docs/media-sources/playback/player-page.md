---
title: Player Page
description: Playing media from a web page in a hidden WebView, and the JavaScript bridge that drives it.
nav: Player Page
order: 17
category: Media Sources
---

# Player Page

A player page is a web page, loaded in a hidden WebView, that plays a track itself. Boppa drives it through a small JavaScript bridge and listens for the events it reports back. Use a player page only when the site's media can't be played any other way. Otherwise, play [from the container](/docs/media-sources/playback).

## Configuring the player page

A package has a player page when it includes one of:

- **`playback/index.html`**: a small, self-contained document shipped in the package. It loads with `https://<fqdn>` as its base URL, where `<fqdn>` is the source's [`fqdn`](/docs/media-sources/package#fqdn). This is appropriate when full control over the top-level document is required, or when the real player needs to be embedded in an `<iframe>`.
- **`url`** in `playback/config.json`: an existing page, typically one already hosted by the site. This is appropriate when a page on the site already contains a working `<audio>` or `<video>` element and enough of its own JavaScript to load and play a given track.

A package can't have both. `customUserAgent` in [`playback/config.json`](/docs/media-sources/package#playbackconfigjson) sets a custom user agent for the page.

Every `.js` file in `playback/` is injected into the page as a [user script](/docs/media-sources/package#user-script-metadata), in file name order. Scripts are injected into every frame of the document, including any `<iframe>` elements, not only the top-level frame.

The page shares the source's web data with its workers and popups, so a session cookie set by a [popup](/docs/media-sources/popups) is there for the player page too.

## Boppa ↔ WebView communication

### Functions Boppa calls

The player page (or its scripts) registers the following functions with `boppa.playback.register`, the same call the [container](/docs/media-sources/container) uses. Boppa calls them directly, a function that isn't registered is simply skipped, with no error surfaced.

```js
boppa.playback.register({
  init: async function () { ... },
  load: function (trackData) { ... },
  play: function () { ... },
  pause: function () { ... },
  seek: function (ms) { ... },
  stop: function () { ... },
})
```

`register` can be called more than once, for example from separate scripts, and each call adds to the functions already registered.

| Function | Called when | Argument |
| --- | --- | --- |
| `init()` | Once the page has loaded. | None. |
| `load(trackData)` | A new track is selected for playback. | An object describing the track, see [Track data](#track-data) below. |
| `play()` | Playback should start or resume. | None. |
| `pause()` | Playback should pause. | None. |
| `seek(ms)` | The playhead should move to a specific position. | Position in milliseconds. |
| `stop()` | Playback has ended entirely, for example when switching to a different media source. | None. |

### `init`

Optional. `init` may return a promise, and Boppa waits for it. While a source is being added, the **Add Source** screen waits for the page to load and for `init` to finish. If the page fails to load or `init` throws, adding the source fails with the error's message. When the app launches, Boppa loads each player page and runs `init` in the background.

### Track data

The object passed to `load` has the following shape:

```js
{
  id: "unique-id", // the track's id from a search, list, or get handler
  title: "Track Title",
  subtitle: "Artist Name", // null if unknown
  duration: 213000, // milliseconds, null if unknown
  lowResArtworkUrl: "https://...", // null if unknown
  highResArtworkUrl: "https://...", // null if unknown
  url: "https://...", // null if unknown
  metadata: { any: "JSON object" },
  loadToken: "00000000-0000-0000-0000-000000000000", // unique per load call, see below
}
```

`metadata` is carried through unchanged from whichever handler produced the track, see [Result shape](/docs/media-sources/search#result-shape). It defaults to `{}` if the handler didn't set it.

`loadToken` identifies this specific `load` call. If the page's playback events (below) echo it back, Boppa uses it to ignore events left over from a track it has since moved away from. This matters if the page reuses one `<audio>`/`<video>` element across tracks: tapping a second track before the first one's events (for example `"play"`) have fired doesn't guarantee those in-flight events are discarded, since `load` itself doesn't cancel anything already in motion. Without the token, such a stale event could be misread as a state change for the newly selected track. Echoing the token is optional, a page that doesn't include it in its events simply doesn't get this protection.

Boppa also preloads artwork for nearby tracks in the queue by inserting hidden `<img>` elements into the player page, served from Boppa's on-device image cache.

### Events the page reports

The page reports playback state back to Boppa by calling `boppa.postEvent(eventObj)`, a function Boppa injects automatically.

| `eventObj.type` | Meaning | Additional fields |
| --- | --- | --- |
| `"play"` | Playback has started or resumed. | None. |
| `"pause"` | Playback has paused. | None. |
| `"progress"` | The current playback position has changed. | `currentTime`, `duration` (seconds). |
| `"duration"` | The track's duration has been resolved. | `value` (seconds). |
| `"finish"` | The track has finished playing. Boppa advances to the next track in the queue. | None. |
| `"error"` | Playback has failed. | `message` (string). |

Every one of these can also carry `loadToken`, echoing the value from the `trackData` the event pertains to:

```js
boppa.postEvent({ type: "play", loadToken: currentLoadToken })
```

The player page should track `currentLoadToken` in a variable, update it at the top of its `load` handler, and read it back whenever it reports one of these events.

Be careful with anything reported from inside an async callback started by that `load` handler, for example a `.catch()` on the element's `play()` promise, or a `.then()` following a `fetch()` used to resolve the actual stream URL. By the time that callback runs, a newer `load` call may already have overwritten the shared `currentLoadToken` variable, so reading it there tags the event with the wrong (newer) token, which then passes Boppa's staleness check instead of being dropped by it. Capture the token in a local variable at the top of the handler instead, and pass that captured value explicitly wherever an event is reported from one of these callbacks:

```js
function loadTrack(trackData) {
  const thisLoadToken = trackData.loadToken
  currentLoadToken = thisLoadToken
  fetchStreamUrl(trackData.url).then(function (url) {
    audio.src = url
    audio.play().catch(function (e) {
      // Use thisLoadToken here, not currentLoadToken, a later load call
      // may have already changed it by the time this rejection fires.
      boppa.postEvent({ type: "error", message: e.message, loadToken: thisLoadToken })
    })
  })
}
```

Listeners attached directly to the media element (`playing`, `pause`, `timeupdate`, and so on) don't need this, they only fire for whatever is actually loaded on the element right now, which is exactly what the shared `currentLoadToken` variable tracks by that point.

### Commands the page can request

If you wish to implement track navigation within the player page, you can forward those requests back to Boppa by calling `boppa.postEvent` with one of the following types:

| `eventObj.type` | Effect | Additional fields |
| --- | --- | --- |
| `"previoustrackCommand"` | Requests that Boppa skip to the previous track. | None. |
| `"nexttrackCommand"` | Requests that Boppa skip to the next track. | None. |

Play, pause, and seek are different: since the page already registers `play`/`pause`/`seek`, an intercepted play/pause/seek request should just call those functions directly rather than going through Boppa.

## `boppa.store`

```js
await window.boppa.store.set("apiKey", key)
const apiKey = await window.boppa.store.get("apiKey")
await window.boppa.store.remove("apiKey")
```

The player page shares the container's [`boppa.store`](/docs/media-sources/container#boppastore), so a value the page writes is there for the data handlers too. In the page, `get`, `set`, and `remove` return promises of what the container's versions return.

## Triggering a popup

If the player page needs to present an interactive flow, for example to refresh an expired session, call `boppa.popup('<id>')`, where `<id>` is the name of a folder in the package's `popup/`. Boppa stops playback, presents the popup, and reloads the player page once the popup is dismissed. See [Popups](/docs/media-sources/popups) for details.
