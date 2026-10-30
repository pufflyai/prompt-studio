---
"pstdio": patch
"@pstdio/canvas": patch
"canvas": patch
"pstdio-planner": patch
"pstdio-base-themes": patch
---

Build Prompt Studio's own canvases with `@pstdio/canvas`: support Vite `?raw` and `?url` imports, keep frame state for common controls, rebuild when `tsconfig.json` files or the builder change, and move the Canvas design pages into `@pstdio/ui`.
