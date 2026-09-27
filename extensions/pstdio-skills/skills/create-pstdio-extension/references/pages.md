# Pages and panels

A page owns a route, its routed resource, and page panels. A view supplies content. A mode owns shared panels, region policy, and chrome. Use Main, Side, and Secondary for panels; use `navigationItems` and `navigationTrees` for Sidenav content.

## Choose a structure

| Need | Pattern |
| --- | --- |
| Searchable domain objects | Resource kind, resource page, and command-palette provider |
| Navigation beside an editor | Native tree attached through `viewMenus` |
| Properties belonging to the current view | Attached controls view |
| Independent auxiliary content | Side or Secondary Panel |
| Controls tightly coupled to a preview | Toolbar inside the Main webview |
| Standard forms | Native controls with typed parameter definitions |
| Custom interactive content | Webview using exported shared UI components |

An attached menu follows its owner view and uses the host's resizable layout. Use an independent panel when the content has its own lifecycle or needs to remain available beyond that view. A preview's local toolbar is part of its content, not another panel.

The [resource reviewer](examples/resource-reviewer/extension.ts) combines these patterns. Its catalog drives tree navigation and palette results through the same page-target helper. Registering a resource kind alone does not provide search results or a destination. Preserve resource ownership and project fields when forwarding an existing resource.

## Resource and Main presentation

Declare `resource: { kinds }` when the route accepts a resource. Pass `ResourceRef` with `type`, `id`, and optional `label`. Keep ownership fields intact. Do not build resource URIs in author code.

Choose Main separately:

- `main: { kind: "view", view, cardinality }` renders routed content. Multiple instances require a resource-bound page. Resource view pages declare a `parent` for navigation and, when multiple resources are supported, closing their last tab.
- `main: { kind: "panels", empty }` renders peer Main panels and shows the empty view when none are open. A routed workspace remains the page context while its file panels change.

Additional page `slots` and mode placements both use `item`. A static item has `kind: "view"`, `view`, and `presence`. A binding item has `kind: "binding"` and `binding: { kinds, view, cardinality, add? }`. The same region, mounting, and tab rules apply to both.

`cardinality: "one"` rebinds one instance. `"many"` retains separate resource instances. Use `open: "pin"` to retain a tab or `"preview"` to permit replacement. Generated references such as `page.panels.inspector` identify page slots.

## Navigation

A page target changes location and selects the page's mode. Use an explicit nested `parent` page target for contextual breadcrumbs. The host does not infer destinations from a resource kind or view.

A panel target opens a panel while preserving the route and breadcrumbs. Its page or mode must be active. To enter an owner and open its panel together, use a compound target containing page and panel steps. All steps prepare before any state changes. Commands and links are standalone; complete command work before requesting navigation.

Omitted mode chrome keeps host navigation, including navigation owned by a custom mode. A replacement view or `false` overrides it. Shared mode panels retain mounted state across pages when declared `keep-mounted` and dispose when their owner is removed.

## Closing

Static presence is `fixed`, `open`, or `closed`. Fixed panels cannot close. Open and closed are initial values; saved user choices win later.

A Main view with `cardinality: "one"` is the page content: it has no close action or resource tab by default. Selecting another resource rebinds that view. A Main view with `cardinality: "many"` keeps its tab and close action even with only one resource open; closing the last tab follows the page's declared parent. Closing an auxiliary panel preserves the route. `openOn: "page-resource"` opens a matching binding on page navigation. Closing it keeps it closed until another navigation opens it.

A webview declares `placement.close` and calls `host.call("placement.close", {})`. It supplies no placement identity. The host uses the same controller as native tabs and rejects closing fixed content, including single-resource Main views.

Let the host derive tab and header visibility. Do not hide host chrome or build replacement tab bars to compensate for a host defect; report and fix that behavior in the platform.

Tab labels use explicit tab presentation, resource label, then view title. Close actions use the same label. Hiding a region preserves its instances; removing an owner disposes them.

## Provider refs and host pages

Export `qualifyRef(owner, ref)` from provider contract modules. It supports nested page-panel refs and preserves command parameter/result types. Providers continue to register local definitions.

Use `workbenchPages.sessions` and `workbenchPages.workspaces` without a resource for their home pages. Use `workbenchPages.session` with a session or session draft, and `workbenchPages.workspace` with a workspace.

## Refresh installed guidance

The source of this shipped skill is `extensions/pstdio-skills/skills/create-pstdio-extension` in the Prompt Studio repository. `.agents/skills` contains installed copies, not a second authoring source.

Update `pstdio-skills` with the SDK release, then run `pst agents install-skills <agent-id>` from the project folder. The installer adds missing skills and replaces each existing same-name skill directory. Before running it, copy any local edits outside that directory or move them into the extension's source skill. The installer does not merge local edits. Restart the agent session to read the updated files. For source development, first load the skill extension through `pst extensions dev <path-to-pstdio-skills>`.

Commands and row activation callbacks request navigation with `ctx.navigation.open(target)` and return data. After committing deletion, call `await ctx.resources.removed(resource)`. The host removes clean resource bindings across clients and inactive pages. Other active resources stay selected. Dirty editors retain their draft and stop saving until explicitly closed. Keep missing-resource loads for disconnected clients and use update-only writes for existing documents.
