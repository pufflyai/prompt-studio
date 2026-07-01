---
"pstdio": minor
---

Rework extension control panels to mirror tree/file renderers: rename the `controls` contribution to `controlsRenderers` (a reusable, placement-free renderer) and place it with a `view` via `controlsRenderer: "<id>"`, so the standard resource-companion path opens it. Resolve localized labels in controls query results, and let resource param chips open their target resource from the panel.
