---
"canvas": minor
"@pstdio/canvas": patch
---

UI Canvas shows the project's own canvases from the build that `pstdio-canvas watch` writes, reloads only the frames whose code changed, and no longer ships a prebuilt catalog; canvas code always imports the `@pstdio/canvas` that runs the build.
