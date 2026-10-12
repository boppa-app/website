---
title: Popups
description: Presenting a visible WebView when the user has to act, such as logging in.
nav: Popups
order: 20
category: Media Sources
---

# Popups

Some media sources need a session before their search, browsing, or playback works. A **popup** is a visible WebView the source can present when something requires the user, such as logging in.

Each popup is a folder in the package's `popup/`, named after the popup's id:

```
popup/
└── login/
    ├── config.json
    └── 01-detect.js
```

```json
{
  "title": "Log In",
  "url": "https://example.com/login"
}
```

`config.json` sets the page and the sheet's title. Every `.js` file in the folder is a [user script](/docs/media-sources/package#user-script-metadata) injected into the popup's page. See [Package](/docs/media-sources/package#configjson-for-workers-and-popups) for the fields.

A popup is never shown on its own. It's presented when the container or the player page asks for it by id. Boppa then stops playback and presents a visible, scrollable WebView in a sheet, titled with the popup's `title`, with a manual dismiss button. Only one popup can be presented at a time.

## Presenting a popup from the container

```js
await boppa.popup("login")
const cookies = await boppa.cookies()
```

`boppa.popup(id)` resolves to `{ dismissed: true }` once the popup is dismissed. The container can then read the new session with [`boppa.cookies()`](/docs/media-sources/container#boppacookiesurl) and retry whatever needed it. It rejects if the package has no popup with that id, or if another popup is already showing.

## Presenting a popup from the player page

```js
boppa.popup("login")
```

The player page reloads once the popup is dismissed. See [Player Page](/docs/media-sources/playback/player-page#triggering-a-popup).

## The popup page contract

| Function | Purpose |
| --- | --- |
| `window.boppa.dismissPopup()` | Optional. Dismisses the popup, for example once a login flow completes. The user can also dismiss it manually. |

```js
// ==UserScript==
// @name        Detect Login
// @run-at      document-end
// ==/UserScript==

(function () {
  if (document.cookie.includes("session=")) {
    window.boppa.dismissPopup()
  }
})()
```

## Cookies

Each media source has its own web data, shared by its player page, workers, and popups. A session cookie set while the user logs in through a popup is there for all of them, and for the container: [`boppa.cookies()`](/docs/media-sources/container#boppacookiesurl) reads them, and [`fetch`](/docs/media-sources/container#fetch) attaches the matching ones with `credentials: "include"`.

For values that must be computed or extracted, such as an API key a worker reads from the site, use [`boppa.store`](/docs/media-sources/container#boppastore).

**Clear Web Data** in a source's settings clears its cookies, site storage, and `boppa.store`.
