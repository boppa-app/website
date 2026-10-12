---
title: Search
description: The search handlers that power Boppa's Search tab, one per media type.
nav: Search
order: 14
category: Media Sources
---

# Search

A media source offers one search category per handler it registers. Each is optional, a type with no search handler is simply not offered as a search category for that source.

```js
boppa.data.register({
  "search/tracks/song": async function (params, { signal }) { /* ... */ },
  "search/tracks/video": async function (params, { signal }) { /* ... */ },
  "search/profiles/artist": async function (params, { signal }) { /* ... */ },
  "search/tracklists/album": async function (params, { signal }) { /* ... */ },
  "search/tracklists/playlist": async function (params, { signal }) { /* ... */ },
})
```

The part after `search/tracks/`, `search/profiles/`, or `search/tracklists/` is a type id declared in `manifest.json`, see [Media Types](/docs/media-sources/media-types).

## Invocation

When a user types a query in a category, Boppa calls the matching handler with:

| Property | Type | Present when |
| --- | --- | --- |
| `params.query` | string | Always. |
| `params.previousResult` | object | Only when fetching a subsequent page. See [Pagination](#pagination) below. |

See [Container](/docs/media-sources/container#calling-convention) for the calling convention and the environment (`fetch`, timers, `console`, and so on) available to the handler.

## Result shape

A search handler returns an object with an `items` array. The shape of each item depends on the family being searched.

Boppa stores the tracks, profiles, and tracklists it sees, and merges what a handler returns into what it already knows. When an item Boppa has already stored comes back, every optional field that's omitted (or `null`) keeps its stored value, and an empty `title` or `name` is ignored. Only values the handler actually provides overwrite stored ones.

That means a handler should leave out anything it doesn't know rather than fill in a placeholder. Don't return `subtitle: "Unknown Artist"`, `duration: 0`, or an empty string for artwork or a URL when the page just doesn't show that value, because Boppa would store the placeholder over real data it got from a fuller page.

An `id` may be a string or a number. An item missing its `id` or its `title` (or `name`) is dropped.

### Tracks

```js
return {
  items: [
    {
      id: "unique-id", // required
      title: "Track Title", // required
      subtitle: "Artist Name", // optional
      duration: 213000, // optional, milliseconds
      lowResArtworkUrl: "https://...", // optional
      highResArtworkUrl: "https://...", // optional
      url: "https://...", // optional, the track's page, used for sharing
      type: "song", // optional, a declared track type
      metadata: { any: "JSON object" }, // optional
      profiles: [{ id, name, type, lowResArtworkUrl, highResArtworkUrl }], // optional
      tracklists: [{ id, title, type, subtitle, lowResArtworkUrl, highResArtworkUrl }], // optional
    },
  ],
}
```

`id` and `title` are the only required fields, every other field may be omitted.

`type` is the item's track type. When omitted, the item takes the type of the category being searched.

`metadata` is opaque to Boppa. It may be any JSON object and is passed through unchanged to playback, as `track.metadata` in [`resolve`](/docs/media-sources/playback#resolve) and in the [player page's](/docs/media-sources/playback/player-page#track-data) `load`. Use it to cache playback artifacts so the next play of the track can skip work. A later result for the same track can replace it, so never put anything there that has to persist, and make sure playback still works when it's empty. The container can update it later with [`boppa.updateTrackMetadata`](/docs/media-sources/container#boppaupdatetrackmetadatatrackid-metadata).

`profiles` and `tracklists` are the track's own profiles and tracklists, such as the artists who made a song and the album it's on. They let a track's actions link straight to each of its profiles and tracklists without an additional lookup.

- A profile reference needs `id` and `name`. `type` defaults to the first declared profile type.
- A tracklist reference needs `id` and `title`. Its `type` must be listed in the track type's [`belongsTo`](/docs/media-sources/media-types#belongsto), and defaults to the first entry there.

Boppa remembers a track's profiles and tracklists once it has stored the track, and treats an omitted field differently from an empty array when it sees the track again:

- **Omitted** (or `null`): the handler doesn't know. Boppa keeps whatever profiles or tracklists it already has for the track.
- **Empty array** (`[]`): the track has none. Boppa removes any profiles or tracklists it had for the track.
- **Non-empty array**: Boppa replaces the track's profiles or tracklists with exactly these.

So only return `[]` when you're sure the track has no profiles or tracklists, otherwise omit the field instead. An array whose entries are all missing a required field is treated as omitted. An array with some valid entries keeps the valid ones.

### Profiles

```js
return {
  items: [
    {
      id: "unique-id", // required
      name: "Artist Name", // required
      type: "artist", // optional, a declared profile type
      lowResArtworkUrl: "https://...", // optional
      highResArtworkUrl: "https://...", // optional
      url: "https://...", // optional, the profile's page
    },
  ],
}
```

`type` defaults to the type of the category being searched.

### Tracklists

```js
return {
  items: [
    {
      id: "unique-id", // required
      title: "Album Title", // required
      subtitle: "Artist Name", // optional
      year: 1975, // optional
      lowResArtworkUrl: "https://...", // optional
      highResArtworkUrl: "https://...", // optional
      url: "https://...", // optional, the tracklist's page
      owner: { id, name, type, lowResArtworkUrl, highResArtworkUrl }, // optional
    },
  ],
}
```

A tracklist always takes the type of the category being searched.

`owner` is the profile behind the tracklist, such as the user who made a playlist. It needs `id` and `name`, and its `type` defaults to the first declared profile type. When `subtitle` is omitted, Boppa shows the owner's name in its place.

## Pagination

To support infinite scroll, return any additional fields alongside `items`. Boppa treats every field other than `items` as continuation state and, if at least one such field is non-null, stores it. When the user scrolls to the end of the current results, the same handler runs again with `params.previousResult` set to exactly that object:

```js
const page = params.previousResult?.page ? params.previousResult.page + 1 : 1

// ... fetch page ...

const result = { items }
if (items.length === pageSize) {
  result.page = page // there may be more pages, continue
}
return result // omitting result.page signals there are no more pages
```

If no field besides `items` is present, or every such field is `null`, Boppa treats the result as the final page and does not request more.

## Errors

If the handler throws, or returns a rejected promise, Boppa shows the error's message and the search category is left empty. Throw an `Error` with a specific message to tell the user what went wrong.
