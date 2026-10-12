---
title: Media Sources
description: How a media source package teaches Boppa to search, browse, and play from a site.
nav: Overview
order: 10
category: Media Sources
---

# Media Sources

A media source is a package that tells Boppa how to work with one site. The package is a zip archive of a manifest and JavaScript. Boppa runs that JavaScript to search the site's catalog (songs, artists, albums, and so on), browse it, and play media. This section documents the package format and every contract a package implements. To use a media source developed by the community, check out [r/BoppaApp](https://reddit.com/r/BoppaApp).

## Contents of a package

```
example/
├── manifest.json        # identity, domains, and media types
├── icon.svg             # optional
├── container/           # JavaScript run in the source's container
│   ├── 10-data.js
│   └── 20-playback.js
├── playback/            # optional player page
│   ├── config.json
│   ├── index.html
│   └── 01-bridge.js
├── workers/             # optional background pages
│   └── client/
│       ├── config.json
│       └── 01-client.js
└── popup/               # optional interactive pages
    └── login/
        ├── config.json
        └── 01-detect.js
```

- **`manifest.json`**: the source's identity, the domains it talks to, and the [media types](/docs/media-sources/media-types) it offers. See [Package](/docs/media-sources/package).
- **`container/`**: the scripts Boppa loads into the source's [container](/docs/media-sources/container), a long-running JavaScript engine. These scripts register the handlers behind [search](/docs/media-sources/search), [browsing](/docs/media-sources/list-get), and [playback](/docs/media-sources/playback).
- **`playback/`**: a [player page](/docs/media-sources/playback/player-page) loaded in a hidden WebView. Only needed when the site's media can only be played from a web page.
- **`workers/`**: [workers](/docs/media-sources/workers), hidden WebViews the container can start and call into, for work that needs a real browser.
- **`popup/`**: [popups](/docs/media-sources/popups), visible WebViews for anything that needs the user, such as logging in.

## How Boppa uses a package

When a media source is added, Boppa unpacks the package, creates the source's container, and loads every script in `container/`. The container stays alive while the app runs, until the source is disabled or removed, so state built up by one call is still there for the next.

Every search, page, and track in the app maps to a handler the container registered. Boppa only offers what is registered. A source that registers a song search but no album search gets a Songs tab in Search and no Albums tab.

Each media source gets its own isolated web data. Cookies and storage set by its player page, workers, and popups are never shared with another source.
