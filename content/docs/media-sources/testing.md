---
title: Testing & Debugging
description: How to iterate on a media source package and diagnose failures.
nav: Testing & Debugging
order: 21
category: Media Sources
---

# Testing & Debugging

A media source runs in two different environments: the [container](/docs/media-sources/container), which holds its handlers, and the ordinary web pages behind its player page, workers, and popups. This page covers the tools available for each.

## Errors when adding a package

Adding a media source can fail for a few distinct reasons, each surfaced with a specific message.

| Cause | Message |
| --- | --- |
| The entered text could not be parsed as a URL. | "The package URL could not be constructed" |
| The server returned a non-200 status. | "The server returned an error (HTTP `<code>`)", or a not-found message for a 404. |
| The file is not a zip archive. | "Malformed media source package: only .boppa and .zip media source packages are supported" |
| The archive is damaged, encrypted, or uses unsupported compression. | "Malformed media source package: ..." |
| `manifest.json` is missing. | "Malformed media source package: manifest.json is missing" |
| `manifest.json` is missing a field, has a field of the wrong type, or declares an invalid type. | "Malformed manifest.json: ..." |
| A `config.json`, `playback/config.json`, or user script is invalid. | "Malformed `<path>`: ..." |
| The package has both `playback/index.html` and a `url` in `playback/config.json`. | "Malformed media source package: use either playback/index.html or url in playback/config.json, not both" |
| The update header is invalid or doesn't match `manifest.json`. | "Malformed media source package header: ..." |
| A source with the same `id` is already added. | "A media source with ID "`<id>`" has already been added" |
| `init` threw or timed out. | "Script error: `<message>`" or "The script timed out" |
| The player page failed to load. | "The player page could not be loaded: ..." |
| The player page's `init` threw. | "The player page failed to start up: ..." |

The malformed-package messages name the exact file and field that failed, for example a missing required key or a value of the wrong type, which is generally enough to locate the problem directly.

## Errors from handlers

| Cause | Message |
| --- | --- |
| The handler threw, or returned a rejected promise. | "Script error: `<message>`" |
| The handler didn't settle within 30 seconds. | "The script timed out" |
| The handler returned something other than an object. | "Invalid result: ..." |
| `resolve` returned an invalid stream descriptor. | "Playback script returned an invalid stream: ..." |

See [Container](/docs/media-sources/container) and [Playback](/docs/media-sources/playback) for the contracts these errors correspond to.

## Reading logs

Boppa writes its logs to files you can open in the **Files** app, under **On My iPhone → Boppa → Logs**, or from a Mac in Finder:

| File | Contents |
| --- | --- |
| `all.log` | Everything. |
| `warning.log` | Warnings and errors only. |
| `error.log` | Errors only. |

The container's `console` output lands in these files, tagged with the source's `id`. So do uncaught exceptions with their file and line, every `fetch` the container makes with its status and timing, every `fetch` blocked by `allowedUrls`, the data handlers each source registered, and every stream descriptor `resolve` returned. During development, the same output appears in your development environment's console.

## Inspecting player pages, workers, and popups

Unlike the container, the pages behind the player page, workers, and popups are ordinary web content, and Boppa makes them inspectable with Safari's Web Inspector, attached to the running app. This provides a full DOM inspector, console, and network panel for the actual page, which is the most direct way to debug a page's own JavaScript, confirm that `load` and the other [contract functions](/docs/media-sources/playback/player-page) are registered, or watch `boppa.postEvent` calls as they happen.

## Iterating on a package

The recommended workflow for actively developing a package is to [build](/docs/media-sources/publishing#building-a-package) it into a local folder and serve that folder with [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`wrangler pages dev .`), then expose that local server with a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (`cloudflared tunnel --url http://localhost:8788`), and add the source once from that URL. From then on, each change just needs an incremented `version` in `manifest.json` and in the update header, a rebuild, and an app restart. Boppa's normal launch-time update check picks up the new version automatically, no remove-and-re-add required. There is no hot reload support at the moment.

Alternatively, you can import the `.boppa` or `.zip` file directly from your device. A media source added this way has no URL to update from, so deleting and adding the file after each edit is the only way to update it.
