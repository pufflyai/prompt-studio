---
"@pstdio/ui": minor
---

Feature-slice @pstdio/ui: add ./diff, ./data-renderer, ./mermaid and ./terminal subpath entries, declare sideEffects for tree-shaking, fold the terminal UI in (replacing @pstdio/ui-terminal), and move the heavy features (diff, data-renderer, mermaid, code editor) out of the root barrel into their subpaths.
