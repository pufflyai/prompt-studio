---
"canvas": minor
"@pstdio/canvas": minor
---

UI Canvas shows the project's own canvases from the build that `pstdio-canvas watch` writes, reloads only the frames whose code changed, and no longer ships a prebuilt catalog; canvas code always imports the `@pstdio/canvas` that runs the build; `@pstdio/canvas` no longer exports `./indexer`.
