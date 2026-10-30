---
"pstdio": patch
"@pstdio/canvas": patch
"canvas": patch
"pstdio-planner": patch
"pstdio-artifacts": patch
"pstdio-base-themes": patch
---

Build Prompt Studio's own canvases with `@pstdio/canvas`: pass the host's whole frame theme (`id`, `mode`, `tokens`) to decorators, support Vite `?raw` and `?url` imports, keep frame state for common controls, rebuild when `tsconfig.json` files or the builder change, and move the Canvas design pages into `@pstdio/ui`.
