# Dashboard UI contributions

Define each body once with `defineView`. Native tree, file, controls, table, and Kanban renderers share the same placement rules as webviews.

A page owns a route, optional `resource: { kinds }`, and Main presentation. `main` renders either a view or peer panels with an empty state. Additional `slots` and mode placements use the same static-view or resource-binding `item`. A binding declares `kinds`, `view`, `cardinality`, and optional `add`.

Use page targets for locations and panel targets for auxiliary content. Generated refs such as `page.panels.inspector` preserve the page owner. Mode placements live across pages in their mode. Main, Side, and Secondary are the panel regions. Navigation items and trees contribute to the default host sidebar, including in custom modes.

The [cookbook](./cookbook.md) links compiled examples for editable pages, inspectors, shared panels, editor collections, provider refs, and webview lifecycle. See [page ownership](./contextual-workbench-composition.md) for the complete rules.
