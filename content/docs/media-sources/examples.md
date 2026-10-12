---
title: Examples
description: A complete, minimal media source package to read alongside these docs.
nav: Examples
order: 23
category: Media Sources
---

# Examples

You can find live examples in the [boppa-app/media-sources](https://github.com/boppa-app/media-sources) repository.

## A minimal package

This package searches songs on a made-up JSON API at `api.example.com`, lists the songs on an album, and plays each song from a plain URL. It's the smallest package that covers search, browsing, and playback.

```
example/
├── manifest.json
└── container/
    └── 10-source.js
```

### `manifest.json`

```json
{
  "id": "example.com",
  "version": "1.0.0",
  "name": "Example",
  "allowedUrls": ["api.example.com"],
  "trackTypes": [{ "id": "song", "belongsTo": ["album"] }],
  "profileTypes": [{ "id": "artist" }],
  "tracklistTypes": [{ "id": "album" }]
}
```

### `container/10-source.js`

```js
const API = "https://api.example.com"

function toSong(song) {
  return {
    id: song.id,
    title: song.title,
    subtitle: song.artist.name,
    duration: song.durationSeconds * 1000,
    highResArtworkUrl: song.coverUrl,
    profiles: [{ id: song.artist.id, name: song.artist.name }],
    tracklists: [{ id: song.album.id, title: song.album.title }],
  }
}

boppa.data.register({
  "search/tracks/song": async function (params, { signal }) {
    const page = params.previousResult?.page ?? 1
    const response = await fetch(
      API + "/search?q=" + encodeURIComponent(params.query) + "&page=" + page,
      { signal },
    )
    if (!response.ok) throw new Error("Search failed (HTTP " + response.status + ")")
    const data = await response.json()
    const result = { items: data.songs.map(toSong) }
    if (data.hasMore) result.page = page + 1
    return result
  },

  "list/tracklist/album": async function (params, { signal }) {
    const response = await fetch(API + "/albums/" + params.id, { signal })
    const album = await response.json()
    return { items: album.songs.map(toSong) }
  },
})

boppa.playback.register({
  resolve: async function (track, { signal }) {
    const response = await fetch(API + "/songs/" + track.id + "/stream", { signal })
    const stream = await response.json()
    return { kind: "direct", url: stream.url }
  },
})
```

Zip the folder (see [Building a package](/docs/media-sources/publishing#building-a-package)) and add it in **Settings → Media Sources → Add Source**. Boppa shows a Songs search category, opens a song's album from its actions, and plays songs from the URL `resolve` returns.

The search handler returns `page` while there are more results, and Boppa passes it back as `params.previousResult.page` for the next one. See [Pagination](/docs/media-sources/search#pagination).
