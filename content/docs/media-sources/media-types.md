---
title: Media Types
description: Declaring the kinds of tracks, profiles, and tracklists a media source offers.
nav: Media Types
order: 12
category: Media Sources
---

# Media Types

Boppa works with three families of media:

- **Tracks**: anything that plays, such as songs, videos, or episodes.
- **Profiles**: anyone behind tracks or tracklists, such as artists, users, or channels.
- **Tracklists**: anything that groups tracks, such as albums, playlists, or series.

A media source declares which kinds of each family it has in `manifest.json`, with `trackTypes`, `profileTypes`, and `tracklistTypes`. Each declared type gets its own search category, library section, and set of [handlers](/docs/media-sources/container#data-handlers).

```json
{
  "trackTypes": [
    { "id": "song", "belongsTo": ["album"] },
    { "id": "video" },
    { "id": "short", "name": "Short", "media": "video" }
  ],
  "profileTypes": [
    { "id": "artist" },
    { "id": "user" }
  ],
  "tracklistTypes": [
    { "id": "album" },
    { "id": "playlist" },
    { "id": "mixtape", "name": "Mixtape", "presentation": "album" }
  ]
}
```

## Type ids

A type `id` may only contain letters, digits, `.`, `-`, and `_`, and must be unique within its family. The `id` is what appears in handler names, such as `search/tracks/song`, and in the `type` field of returned items.

Order matters. Search shows track types first, then profile types, then tracklist types, each in the order declared. The first declared track type and profile type are the defaults for any item returned without a `type`.

## Built-in types

These ids come with a name, icon, and behavior already set, so `{ "id": "song" }` is enough:

| Family | `id` | Name | `media` / `presentation` |
| --- | --- | --- | --- |
| Track | `song` | Song | `audio` |
| Track | `video` | Video | `video` |
| Track | `episode` | Episode | `audio` |
| Profile | `artist` | Artist | |
| Profile | `user` | Person / People | |
| Profile | `channel` | Channel | |
| Tracklist | `album` | Album | `album` |
| Tracklist | `playlist` | Playlist | `playlist` |
| Tracklist | `series` | Series | `album` |
| Tracklist | `likes` | Likes | `playlist` |

Any field set on a built-in type overrides its default. Any other `id` is a custom type, and every field is optional for it too. Built-in types have their own icon, and a custom type uses a generic icon for its family.

## Fields

### Every family

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Required. The type's id. |
| `name` | string or object | The display name. A string is the singular, and the plural adds an `s`. For an irregular plural, pass `{ "one": "Person", "other": "People" }`. Defaults to the `id` with its first letter capitalized. |

### `trackTypes`

| Field | Type | Description |
| --- | --- | --- |
| `media` | `audio` \| `video` | What the track is. Defaults to `audio`. Used to word the Search tab, for example "Search music" versus "Search videos". |
| `belongsTo` | list of tracklist type ids | The tracklist types a track of this type can belong to. Every id must be a declared tracklist type. See [`belongsTo`](#belongsto) below. |

### `tracklistTypes`

| Field | Type | Description |
| --- | --- | --- |
| `presentation` | `album` \| `playlist` | How the tracklist is shown. `album` shows the release year beside the subtitle. Defaults to `playlist`. |

## `belongsTo`

A track can link to the tracklists it is part of, such as the album a song is on. A track's actions link to each of them, labeled with the tracklist's title and its type's icon, when the source registers the matching `list/tracklist/<type>` handler. `belongsTo` decides which links Boppa keeps:

- A tracklist reference with a `type` is kept only if that type is in `belongsTo`.
- A tracklist reference without a `type` takes the first type in `belongsTo`.
- A track type with no `belongsTo` keeps no tracklist links at all.

See [Result shape](/docs/media-sources/search#result-shape) for how tracks carry these references.
