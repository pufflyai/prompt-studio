---
"@pstdio/canvas": minor
"pstdio": patch
---

Breaking for `@pstdio/canvas`: decorators now receive the frame's theme as `{ id, mode, tokens? }` instead of a string, `setup` is removed, `CanvasVariant` and `CanvasProject` are renamed to `CanvasFrame` and `CanvasPreview`; builds also support Vite `?raw` and `?url` imports, keep state for common controls, record each frame's `defaultTheme`, and rebuild when `tsconfig.json` files or the builder change.
