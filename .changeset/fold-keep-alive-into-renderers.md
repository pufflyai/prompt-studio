---
"pstdio": minor
---

Fold workbench keep-alive into the renderer registry: set `keepAlive: true` on a renderer registration instead of `keepAlive.register({...})` + `WORKBENCH_KEEP_ALIVE_SLOT_RENDERER_ID` bridge widgets. Subtrees read the active widget claim via `useWorkbenchClaim()`.
