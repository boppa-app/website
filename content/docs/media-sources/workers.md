---
title: Workers
description: Hidden WebViews the container starts and calls into for work that needs a real browser.
nav: Workers
order: 19
category: Media Sources
---

# Workers

The [container](/docs/media-sources/container) has no DOM and no browser. A **worker** is a hidden WebView that loads one of the site's pages, and the container calls into it by name.

## Declaring a worker

Each worker is a folder in the package's `workers/`, named after the worker:

```
workers/
└── client/
    ├── config.json
    └── 01-client.js
```

```json
{
  "title": "Client",
  "url": "https://example.com/",
  "customUserAgent": "Mozilla/5.0 ..."
}
```

`config.json` sets the page the worker loads. Every `.js` file in the folder is a [user script](/docs/media-sources/package#user-script-metadata) injected into that page. See [Package](/docs/media-sources/package#configjson-for-workers-and-popups) for the fields.

The worker's page shares the source's web data with its player page and popups. A cookie set in a popup is there for the worker, and the other way round.

## The worker page contract

A worker's scripts register request handlers, then signal that the worker is ready:

```js
// ==UserScript==
// @name        Site Client
// @run-at      document-end
// ==/UserScript==

(function () {
  window.boppa.onRequest("lookup", async function (arg) {
    return await window.siteClient.lookup(arg.id)
  })

  window.boppa.workerReady()
})()
```

| Function | Purpose |
| --- | --- |
| `window.boppa.onRequest(name, handler)` | Registers `handler` for calls to `name`. The handler receives the call's argument and may return a value or a promise. |
| `window.boppa.workerReady()` | Required. Signals that the handlers are registered and the worker can take calls. |

Arguments and return values pass through JSON, so only send what JSON can carry. A handler that throws, or returns a rejected promise, fails the call with the error's message.

## Using a worker from the container

```js
const worker = boppa.worker("client")
await worker.start()
const item = await worker.call("lookup", { id: "123" })
worker.stop()
```

| Method | Description |
| --- | --- |
| `start()` | Loads the worker's page and resolves once it calls `boppa.workerReady()`. Starting a worker that is already running resolves right away. Rejects after 30 seconds without `boppa.workerReady()`. |
| `call(name, arg)` | Calls the worker's `name` handler with `arg` and resolves with what it returns. Rejects if the worker hasn't been started, or if the handler doesn't settle within 20 seconds. A call made while the worker is still starting waits for it to be ready. |
| `stop()` | Tears the worker's page down. |

The container owns a worker's lifetime. A worker keeps running until the container stops it, or the source is disabled or removed. Starting workers in [`init`](/docs/media-sources/container#init) and keeping them running is a common pattern for sources that call into a worker throughout the session.

## Workers and the store

What a worker returns lives only in the container's memory. To share a result with the [player page](/docs/media-sources/playback/player-page#boppastore), or keep it across launches, put it in [`boppa.store`](/docs/media-sources/container#boppastore):

```js
async function refreshConfig() {
  const config = await boppa.worker("client").call("readConfig")
  boppa.store.set("siteConfig", JSON.stringify(config))
}

boppa.playback.register({
  init: async function () {
    await boppa.worker("client").start()
    await refreshConfig()
    setInterval(refreshConfig, 30 * 60 * 1000)
  },
})
```
