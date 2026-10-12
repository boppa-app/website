---
title: List & Get
description: The list and get handlers that back tracklist pages, profile pages, and track radio.
nav: List & Get
order: 15
category: Media Sources
---

# List & Get

Where search handlers answer "what matches this query", `list` handlers answer "what is inside this tracklist or profile" and `get` handlers answer "what are the details of this single item". They run in the same [container](/docs/media-sources/container) as search handlers, with the same calling convention.

Every track, profile, and tracklist these handlers return is merged into what Boppa has already stored, exactly like search results. A field that's omitted (or `null`) keeps its stored value, an empty `title` or `name` is ignored. Only values the handler provides overwrite stored ones. So leave out a field rather than returning a placeholder. See [Search: Result shape](/docs/media-sources/search#result-shape) for the full rules and the item shapes.

The fields each handler receives in `params` are listed below.

## `list` handlers

### `list/tracklist/<tracklistType>`

Called when a tracklist's page is opened, with:

| Property | Description |
| --- | --- |
| `params.id` | The tracklist's id, previously returned as `id` from another handler. |

Returns a page of tracks, using the [track shape](/docs/media-sources/search#tracks). A track without a `type` takes the first declared track type.

```js
boppa.data.register({
  "list/tracklist/album": async function (params, { signal }) {
    const album = await fetchAlbum(params.id, signal)
    return { items: album.tracks.map(toTrack) }
  },
})
```

### `list/profileTracks/<trackType>`

Called when a profile's track section is opened to see all of it, for example every song by an artist. Receives:

| Property | Description |
| --- | --- |
| `params.id` | The profile's id. |
| `params.profile` | `{ id, type }` of the profile, so one handler can serve several profile types. |

Returns a page of tracks. A track without a `type` takes `<trackType>`. Without this handler, the section still shows on the profile's page, but can't be opened.

### `list/profileTracklists/<tracklistType>`

Called when a profile's tracklist section is opened to see all of it, for example every album by an artist. Receives the same `params.id` and `params.profile` as `list/profileTracks`.

Returns a page of tracklists, using the [tracklist shape](/docs/media-sources/search#tracklists). Every tracklist takes `<tracklistType>`.

### `list/trackRadio`

Optional. When present, tracks from this source get a *"Start Radio"* action and the queue offers a radio mode, which plays an endless queue of tracks related to a seed track. Called first when radio starts and again automatically as the listener plays through the queue, to keep it topped up. Receives:

| Property | Description |
| --- | --- |
| `params.id` | The seed track's id. |
| `params.type` | The seed track's type, for example `"song"`. |

Returns a page of tracks. A track without a `type` takes the first declared track type. The seed track itself should not be included, only related tracks. Radio stops automatically once a call returns no continuation fields, or if the listener turns radio off.

### Pagination

Every `list` handler supports the same pagination contract described in [Search: Pagination](/docs/media-sources/search#pagination). When the user scrolls to the bottom of the current list (or, for `list/trackRadio`, when the radio queue needs topping up), the handler is called again with `params.previousResult` set to whatever non-`items` fields the previous call returned.

When Boppa needs a complete track list at once, for example when saving a tracklist to the library, it calls `list/tracklist/<tracklistType>` or `list/profileTracks/<trackType>` repeatedly until no continuation is returned and combines every page.

## `get` handlers

### `get/profile/<profileType>`

Called whenever the user opens a profile's page. This is the primary source of a profile page's content, the search result that led to the page generally carries only an id, a name, and artwork. Receives the same `params.id` and `params.profile` as `list/profileTracks`.

```js
return {
  lowResArtworkUrl: "https://...", // optional
  highResArtworkUrl: "https://...", // optional
  tracks: {
    song: [/* track objects */],
    video: [/* track objects */],
  },
  tracklists: {
    album: [/* tracklist objects */],
    playlist: [/* tracklist objects */],
  },
  sectionOrder: ["tracklists.album", "tracks.song", "tracks.video", "tracklists.playlist"], // optional
}
```

`tracks` and `tracklists` are keyed by type id. Each key becomes a section on the profile's page, using the type's name and icon. A track in `tracks.song` without its own `type` takes `song`. Any key may be omitted, the page only shows sections for which data was returned.

`sectionOrder` sets the order of the sections, as `"tracks.<trackType>"` and `"tracklists.<tracklistType>"` entries. A section that isn't listed is not shown. When `sectionOrder` is omitted, track sections come first, then tracklist sections, each in the order the types are declared in `manifest.json`.

A track's actions only link to one of its profiles when the source registers `get/profile/<profileType>` for that profile's type.

### `get/tracklist/<tracklistType>`

Called with `params.id` set to the tracklist's id whenever its page is opened. Returns a single tracklist object, using the [tracklist shape](/docs/media-sources/search#tracklists). Boppa merges the returned fields into whatever is already known about the tracklist (for example, from the search result or list item that led to this page), filling in anything the earlier data was missing, such as artwork.

```js
return {
  id: "unique-id",
  title: "Album Title",
  subtitle: "Artist Name", // optional
  year: 1975, // optional
  lowResArtworkUrl: "https://...", // optional
  highResArtworkUrl: "https://...", // optional
  url: "https://...", // optional
  owner: { id, name, type }, // optional
}
```

### `get/track/<trackType>`

Returns a single track object, using the [track shape](/docs/media-sources/search#tracks), for `params.id`. Reserved for resolving one track's full details. Boppa does not call it yet.

## Errors

As with search handlers, a thrown error or a rejected promise surfaces as an error message in the relevant view. A handler that doesn't settle within 30 seconds times out, see [Container](/docs/media-sources/container#calling-convention).
