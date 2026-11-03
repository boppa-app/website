---
title: Publishing & Sharing
description: Building a media source package, sharing it with others, and how Boppa applies updates.
nav: Publishing & Sharing
order: 22
category: Media Sources
---

# Publishing & Sharing

A media source package is a single file served over HTTP. There is no registration process, publishing a package means making the file reachable at a stable URL.

## Building a package

A package is a zip of the package's files, see [Package](/docs/media-sources/package). Use the `.boppa` extension, and include an [update header](/docs/media-sources/package#update-header) so update checks stay cheap.

From inside the package's folder:

```bash
printf '%-256s' '{"format":1,"id":"example.com","version":"1.0.0"}' > boppa.json
zip -X -0 ../example.boppa boppa.json
zip -X -r ../example.boppa . -x boppa.json
```

The first command writes the header padded to exactly 256 bytes. The second adds it first and uncompressed (`-0`), and the third adds everything else. `-X` leaves out the extra file attributes that would otherwise be stored with each entry, which the header doesn't allow. Remember to update `version` in both `boppa.json` and `manifest.json`.

## Sharing a package

Direct users to the package's URL, or share it as a deep link that adds the media source to Boppa directly:

```
boppa://add-media-source?url=<package URL, percent-encoded>
```

Visit [Add Media Source - Boppa](https://boppa.app/add-media-source) to create a deep link.

The [r/BoppaApp](https://reddit.com/r/BoppaApp) community on Reddit is the primary place to share a media source and discover ones written by others.

## Keeping a package updated

Each time Boppa launches, it checks every source that was added from a URL and has its auto-update option enabled. For each one, Boppa reads the update header from the package's URL with a range request, and compares its `id` and `version` against what is installed.

- If the `id` matches and the `version` differs, Boppa downloads the full package and applies it. The source's package is replaced, while locally held state, such as whether the source is enabled, its position in the source list, and its web data, including `boppa.store`, is preserved.
- If the `id` doesn't match, the update is skipped. This is why `id` must never change between versions of the same package, see [Package: `id`](/docs/media-sources/package#id).
- If the `version` is unchanged, nothing is downloaded.

A package without an update header still works. Boppa downloads the full package on every launch and compares the `id` and `version` in its `manifest.json` instead.

If a download is interrupted, Boppa tries again on the next launch, even when auto-update is off.

To publish a new version, replace the file at its existing URL with one whose `version` is incremented. Users who added the source from that URL and have auto-update enabled receive the change the next time they launch Boppa. The auto-update option for an individual source can be turned off from that source's detail screen in **Settings**, which pins it to whatever package is currently installed.
