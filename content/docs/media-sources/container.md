---
title: Container
description: The long-running JavaScript engine every media source runs in, and the APIs it provides.
nav: Container
order: 13
category: Media Sources
---

# Container

Every media source gets a **container**, a long-running JavaScript engine that holds all of its logic. Search, browsing, and playback are all handlers the container registers. This is not a web page, there is no DOM and no browser API beyond what this page documents.

## Lifecycle

Boppa creates a source's container when the app launches and when the source is added or enabled. It loads every `.js` file directly inside the package's `container/` folder, in byte order of file name, into one shared global scope. A function or variable defined in `10-lib.js` is visible to `20-data.js`.

The container stays alive until the source is disabled or removed, or the app quits. State persists from one call to the next, so caching a token or a lookup table in a variable works. To keep something across launches, use [`boppa.store`](#boppastore).

Boppa then runs the source's [`init`](#init) handler, if one is registered.

## Registering handlers

A container registers its handlers with two functions:

```js
boppa.data.register({
  "search/tracks/song": async function (params, { signal }) {
    // ...
  },
})

boppa.playback.register({
  resolve: async function (track, { signal }) {
    // ...
  },
})
```

Each call takes an object of named functions, and calls merge, so handlers can be spread over several files. Registering a name twice replaces the earlier function.

Register data handlers at the top level of a container script, while it loads. Boppa reads the list of data handlers once every script has run, and a data handler registered after that, for example from inside a `setTimeout`, is logged as a warning and never offered by the app.

## Data handlers

Data handlers back everything the app browses. Each one is named after what it does and the [media type](/docs/media-sources/media-types) it does it for:

| Handler | Used for | Page |
| --- | --- | --- |
| `search/tracks/<trackType>` | A track search category. | [Search](/docs/media-sources/search) |
| `search/profiles/<profileType>` | A profile search category. | [Search](/docs/media-sources/search) |
| `search/tracklists/<tracklistType>` | A tracklist search category. | [Search](/docs/media-sources/search) |
| `get/profile/<profileType>` | A profile's page. | [List & Get](/docs/media-sources/list-get#getprofileprofiletype) |
| `get/tracklist/<tracklistType>` | A tracklist's details. | [List & Get](/docs/media-sources/list-get#gettracklisttracklisttype) |
| `get/track/<trackType>` | A single track's details. | [List & Get](/docs/media-sources/list-get#gettracktracktype) |
| `list/tracklist/<tracklistType>` | The tracks in a tracklist. | [List & Get](/docs/media-sources/list-get#listtracklisttracklisttype) |
| `list/profileTracks/<trackType>` | A profile's tracks of one type. | [List & Get](/docs/media-sources/list-get#listprofiletrackstracktype) |
| `list/profileTracklists/<tracklistType>` | A profile's tracklists of one type. | [List & Get](/docs/media-sources/list-get#listprofiletrackliststracklisttype) |
| `list/trackRadio` | Track radio. | [List & Get](/docs/media-sources/list-get#listtrackradio) |

`<trackType>`, `<profileType>`, and `<tracklistType>` are type ids declared in `manifest.json`. A handler for an undeclared type is logged and ignored. Every handler is optional, and the app hides whatever a source doesn't register.

### Calling convention

```js
boppa.data.register({
  "search/tracks/song": async function (params, { signal }) {
    const response = await fetch(
      "https://api.example.com/search?q=" + encodeURIComponent(params.query),
      { signal },
    )
    const data = await response.json()
    return { items: data.results.map(toTrack) }
  },
})
```

A data handler receives two arguments:

- **`params`**: the call's input. The fields depend on the handler, see its page.

- **`{ signal }`**: an `AbortSignal` that fires when Boppa no longer needs the result, for example because the user typed a new query or left the page. Pass it to `fetch` to cancel the request.

The handler returns a plain object, or a promise of one. Returning anything else is an error. Throwing, or returning a rejected promise, fails the call and Boppa shows the error's message.

A data call has 30 seconds to settle. After that, Boppa abandons it, aborts its `signal`, and shows a timeout error.

## `init`

```js
boppa.playback.register({
  init: async function () {
    // warm caches, fetch a token, start a worker...
  },
})
```

`init` is an optional one-time setup handler. Boppa runs it in the background when the app launches, and always before the first [`resolve`](/docs/media-sources/playback#resolve). While a source is being added, the **Add Source** screen waits for `init` to finish, and if it throws, adding the source fails with its message.

Data handlers don't wait for `init`, so a data handler that depends on something `init` sets up should check for it.

`init` has 30 seconds to settle. If it fails, Boppa runs it again before the next playback.

## Globals

### `fetch`

```js
const response = await fetch(url, {
  method: "POST", // optional, defaults to GET
  headers: { "Content-Type": "application/json" }, // optional, object of string to string
  body: JSON.stringify({ q: "query" }), // optional, a string
  credentials: "include", // optional, "omit" (default), "include", or "same-origin"
  signal, // optional, an AbortSignal
})

response.status // number
response.ok // true for 2xx status codes
response.headers.get("content-type") // string or null
await response.text() // the body as a string
await response.json() // the body parsed as JSON
await response.bytes() // the body as an array of byte values
```

Only `http:` and `https:` URLs are accepted, and only hosts listed in [`allowedUrls`](/docs/media-sources/package#allowedurls). Anything else rejects before the request is made.

Requests carry no cookies by default. With `credentials: "include"` (or `"same-origin"`), Boppa attaches the cookies from the source's web data that apply to the request's URL, the same cookies its player page, workers, and popups see. Cookies set by a response are not stored. Responses are never cached.

Aborting the `signal` cancels the request and rejects the promise with the signal's reason.

### Timers

`setTimeout`, `clearTimeout`, `setInterval`, and `clearInterval` are available with their standard signatures. Since the container is long-running, an interval keeps firing until it is cleared or the container is torn down.

### Web APIs

`URL`, `URLSearchParams`, `AbortController`, `AbortSignal`, `atob`, and `btoa` are available. They cover the common cases, not every edge of the web standards.

### `console`

`console.log`, `console.info`, `console.debug`, `console.warn`, and `console.error` are available. Objects are serialized with `JSON.stringify`, everything else is converted to a string, and arguments are joined with spaces. Output goes to Boppa's log files, see [Testing & Debugging](/docs/media-sources/testing#reading-logs).

## `boppa` APIs

### `boppa.store`

A persistent key/value store for strings, scoped to the source. Use it for anything that should outlive the container, such as values a [worker](/docs/media-sources/workers) reads from the site, or expensive results worth keeping across launches.

```js
boppa.store.set("apiKey", key) // true on success
const apiKey = boppa.store.get("apiKey") // the string, or null if absent
boppa.store.remove("apiKey")
```

All three are synchronous. A key must be 1 to 120 characters of letters, digits, `.`, `-`, and `_`, otherwise the call throws. Values are strings, so store anything else as JSON. Values may be large.

The store is shared by the container and the [player page](/docs/media-sources/playback/player-page#boppastore), so a value one writes is there for the other. It survives updates to the source's package. It's part of the source's web data, so **Clear Web Data** in the source's settings empties it, as does removing the source.

### `boppa.worker(name)`

```js
const worker = boppa.worker("client")
await worker.start()
const item = await worker.call("lookup", { id: "123" })
worker.stop()
```

Starts, calls into, and stops one of the source's workers. See [Workers](/docs/media-sources/workers).

### `boppa.cookies(url)`

```js
const cookies = await boppa.cookies() // { SID: "...", ... }
const sent = await boppa.cookies("https://api.example.com/") // only those sent there
```

Resolves to an object mapping cookie name to value, read fresh from the source's web data, the cookies its player page, workers, and popups have set. With a `url`, only the cookies a request to that URL would carry are included, honoring domain, path, `Secure`, and expiry. A `url` that isn't a valid URL rejects.

### `boppa.popup(id)`

```js
await boppa.popup("login")
```

Presents one of the source's popups and resolves once the user dismisses it. See [Popups](/docs/media-sources/popups).

### `boppa.updateTrackMetadata(trackId, metadata)`

```js
const stored = await boppa.updateTrackMetadata(track.id, { ...track.metadata, ...changes })
```

Replaces the stored [`metadata`](/docs/media-sources/search#result-shape) of one of the source's tracks with `metadata`, which must be a plain object. Use it to cache playback artifacts for the next play of the track. It replaces the whole object, so read the current `metadata`, change it, and pass back everything that should be kept. Resolves to `true` if a stored track was updated, or `false` if Boppa has no stored track with that id.
