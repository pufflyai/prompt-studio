# @pstdio/canvas

## 0.47.0-nightly.20261101230131

_2026-11-01_

### Minor Changes

- 3d76d3a: UI Canvas shows the project's own canvases from the build that `pstdio-canvas watch` writes, reloads only the frames whose code changed, and no longer ships a prebuilt catalog; canvas code always imports the `@pstdio/canvas` that runs the build; `@pstdio/canvas` no longer exports `./indexer`.

## 0.46.0

_2026-10-31_

### Minor Changes

- 63f0303: Publish `@pstdio/canvas` with a `pstdio-canvas` command that builds and watches a project's `.canvas.tsx` files for UI Canvas.
- 8e004ed: Breaking for `@pstdio/canvas`: decorators now receive the frame's theme as `{ id, mode, tokens? }` instead of a string, `setup` is removed, `CanvasVariant` and `CanvasProject` are renamed to `CanvasFrame` and `CanvasPreview`; builds also support Vite `?raw` and `?url` imports, keep state for common controls, record each frame's `defaultTheme`, and rebuild when `tsconfig.json` files or the builder change.
