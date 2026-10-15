---
title: Package
description: The files in a media source package, the manifest.json schema, and the update header.
nav: Package
order: 11
category: Media Sources
---

# Package

A media source package is a zip archive with a `.boppa` or `.zip` extension. This page documents every file Boppa reads from it. A package that is missing a required file, or has a field of the wrong type, is rejected with an error naming the file and the field.

## Layout

| Path | Required | Description |
| --- | --- | --- |
| `manifest.json` | Yes | The source's identity and media types. See [`manifest.json`](#manifestjson) below. |
| `icon.svg` | No | Raw SVG shown as the source's icon. |
| `container/*.js` | No | Scripts loaded into the source's [container](/docs/media-sources/container). |
| `playback/index.html` | No | A [player page](/docs/media-sources/playback/player-page) served from the package. |
| `playback/config.json` | No | A hosted player page and user agent. See [`playback/config.json`](#playbackconfigjson). |
| `playback/*.js` | No | User scripts injected into the player page. |
| `workers/<name>/config.json` | Per worker | A [worker's](/docs/media-sources/workers) page and title. |
| `workers/<name>/*.js` | No | User scripts injected into that worker's page. |
| `popup/<id>/config.json` | Per popup | A [popup's](/docs/media-sources/popups) page and title. |
| `popup/<id>/*.js` | No | User scripts injected into that popup's page. |
| `boppa.json` | No | The [update header](#update-header). |

Files may sit at the root of the archive or inside a single top-level folder, so zipping the package's folder itself works. Hidden files (any path segment starting with `.`) are ignored.

Only `.js` files directly inside a folder are loaded. Files in a subfolder are not. Scripts in a folder load in byte order of their file names, so a numeric prefix such as `10-data.js` and `20-playback.js` is the simplest way to control order.

Every file Boppa reads must be UTF-8.

## `manifest.json`

```json
{
  "id": "example.com",
  "fqdn": "example.com",
  "version": "1.0.0",
  "name": "Example",
  "author": "you",
  "gitUrl": "https://github.com/you/example-source",
  "highlightColor": "#FF5500",
  "allowedUrls": ["example.com", "*.examplecdn.com"],
  "trackTypes": [{ "id": "song", "belongsTo": ["album"] }],
  "profileTypes": [{ "id": "artist" }],
  "tracklistTypes": [{ "id": "album" }, { "id": "playlist" }]
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique identifier for this package. See [`id`](#id). |
| `fqdn` | string | Yes | The site the source serves. See [`fqdn`](#fqdn). |
| `version` | string | Yes | Free-form version string. Compared on update checks, see [Publishing & Sharing](/docs/media-sources/publishing). |
| `name` | string | Yes | Display name shown throughout the app. |
| `author` | string | No | Name or handle of the package's author, shown in the source's details. |
| `gitUrl` | string | No | URL of the git repository the package is developed in. Shown in the source's details, labelled GitHub URL for github.com links, and opens in the browser when tapped. |
| `highlightColor` | string | No | Hex color, for example `"#FF5500"`, used for accents associated with the source. |
| `allowedUrls` | list of strings | No | Hosts the container is allowed to `fetch()`. Defaults to `[fqdn]`. See [`allowedUrls`](#allowedurls). |
| `trackTypes` | list | Yes | The kinds of tracks the source has. See [Media Types](/docs/media-sources/media-types). |
| `profileTypes` | list | Yes | The kinds of profiles the source has. See [Media Types](/docs/media-sources/media-types). |
| `tracklistTypes` | list | Yes | The kinds of tracklists the source has. See [Media Types](/docs/media-sources/media-types). |

The three type lists are required but may be empty.

### `id`

A short, stable string that identifies this package. It may only contain letters, digits, `.`, `-`, and `_`. Choose an `id` once and do not change it. Update checks only apply a package whose `id` matches the one already installed, and two packages with the same `id` can't be added side by side.

### `fqdn`

The site this source serves, for example `archive.org`, using the same characters as `id`. It is also the default for [`allowedUrls`](#allowedurls) and the base URL of a bundled [player page](/docs/media-sources/playback/player-page). Every track, profile, and tracklist Boppa stores is keyed on the source's `fqdn`, not its `id`. Two packages that serve the same site with the same `fqdn` share the same library: saved tracks, playlists, and recently played items work with whichever of them is enabled.

Only one source per `fqdn` can be enabled at a time. Adding or enabling a source disables any other source with the same `fqdn`.

### `allowedUrls`

A list of hosts (or full URLs, from which only the host is used) that the container is allowed to reach with `fetch()`. A request whose host matches an entry, or is a subdomain of one, is allowed. Anything else is rejected before the request is made.

```json
"allowedUrls": ["example.com", "*.examplecdn.com"]
```

`example.com` and `*.example.com` both allow `example.com` and every subdomain of it. If `allowedUrls` is omitted, only the source's own `fqdn` and its subdomains are allowed. There is no way to allow every domain, every domain the container talks to must be listed.

`allowedUrls` limits the container only. Player pages, workers, and popups are ordinary web pages and load whatever they load.

## `playback/config.json`

```json
{
  "url": "https://example.com/player",
  "customUserAgent": "Mozilla/5.0 ..."
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | No | A hosted [player page](/docs/media-sources/playback/player-page). Cannot be combined with `playback/index.html`. |
| `customUserAgent` | string | No | A custom user agent for the player page. |

Only include this file when playing through a WebView.

## `config.json` for workers and popups

Each folder in `workers/` and `popup/` has a `config.json`:

```json
{
  "title": "Log In",
  "url": "https://example.com/login",
  "customUserAgent": "Mozilla/5.0 ..."
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | A label for the page. A popup shows it as the sheet's title. |
| `url` | string | Yes | The page to load. |
| `customUserAgent` | string | No | A custom user agent for the page. |

The folder name is the worker's name or the popup's id, the value scripts pass to [`boppa.worker(name)`](/docs/media-sources/workers) or [`boppa.popup(id)`](/docs/media-sources/popups).

## User script metadata

Every `.js` file in `playback/`, `workers/<name>/`, and `popup/<id>/` is a user script injected into a WebView, and must start with a metadata block:

```js
// ==UserScript==
// @name        Detect Login
// @run-at      document-end
// ==/UserScript==

(function () {
  // ...
})()
```

| Key | Required | Description |
| --- | --- | --- |
| `@name` | Yes | A human-readable label for the script. |
| `@run-at` | No | `document-start`, `document-end`, or `document-idle`. Defaults to `document-idle`, which runs at the same point as `document-end`. |
| `@description`, `@version`, `@author`, `@namespace` | No | Informational only. |

Any other key is rejected, as is a key declared twice. User scripts are injected into every frame of the page, including `<iframe>` elements. A script meant only for the top-level frame should check `if (window !== window.top) return` at its start, and vice versa.

Scripts in `container/` are not user scripts and need no metadata block.

## Update header

A package can start with a small header that lets Boppa check for updates without downloading the whole package. The header is a file named `boppa.json` stored as the **first** entry of the archive:

```json
{"format":1,"id":"example.com","version":"1.0.0"}
```

The entry must be exactly 256 bytes, so pad the JSON with trailing spaces. It must be stored uncompressed, with no extra field. Its `id` and `version` must match `manifest.json`, otherwise the package is rejected. `format` is `1`. A package with a higher `format` asks the user to update Boppa.

A package without the header still works. Update checks just download the whole package every launch instead of reading its first 296 bytes. See [Publishing & Sharing](/docs/media-sources/publishing#building-a-package) for how to build a package with a header.
