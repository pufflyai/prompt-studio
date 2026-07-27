# Extension Navigation

Dashboard navigation is **resource-first**: history stores replayable domain resources, route helpers own mode activation and placement, and renderer-only data is derived at render time rather than stored as navigation identity. Extension-contributed Panels participate in this model through a small set of route helpers so they cannot reintroduce the navigation footguns the framework guards against (wrapper resources in history, Back/Forward tab accumulation, root/detail fallback surprises).

This page describes how extension boards, resource Panels, and mode-layout Panels map onto workbench navigation, and what Back/Forward replay does for each.

## The navigation model

- The **primary** surface is the `main` area (it hosts the `"primary"` anchor). History records the primary area's active placement only; activating a side surface (a left tree, a side panel, a floating session) never pushes a Back/Forward entry.
- A history entry is a **resource** entry when its placement carries a `resource` (replayed via `resources.openResource`) or a **Panel** entry when it does not (replayed via `layout.openPanel`). Mode switches are recorded as **mode** entries.
- Replay restores the entry's mode first, then reopens the resource with `replaceActive: true`, so the primary area is replaced in place — Back/Forward never grows tabs.
- The active primary resource is read through the anchor (`getAnchorResource(layout, "primary")`), the same signal history records. Never read the global `activeResourceUri` for navigation decisions — side-area activations pollute it.

## Route helpers

Primary resource routes are registered through helpers instead of raw `registerPresenter` + `openPanel`, so mode activation, replacement semantics, and the project guard live in one place.

### `registerResourceRoute`

`packages/pstdio-dashboard/src/shared/workbench/route-helper.ts`

A mode-aware primary route. On open it activates the route mode, runs `beforeOpen` side-effect hooks (breadcrumb, sidenav sync — these cannot change navigable identity), and opens the **domain** resource it was handed into the route surface with `replaceActive` forwarded. Because it always places the resource it receives, a root can never silently become a detail. A `requiresProject` guard (default true) sends a project-less open to project selection.

Used by: sessions, workspaces (root in project mode, detail in workspace mode), and extension kanban-renderer **boards** (`dashboard-view` resources). Boards opt out of the project guard to preserve their prior behavior.

### `registerExtensionResourceView`

`packages/pstdio-dashboard/src/modules/extensions/extension-resource-Panel.ts`

For extension Panels that declare a `resourceKind` (e.g. the tickets editor). The presenter keeps the **domain** resource (`ticket`, `session`, …) as the navigable identity, mounts the primary Panel Panel in `main`, and mounts same-kind companion Panels (e.g. a properties panel in `main-right`) bound to the same resource. Primary + companions are resolved from the manifest via `groupResourceEditorViews`.

If metadata includes a mode whose `resourceKind` matches the opened resource, the presenter activates that mode instead of project mode. Resource-bound mode layout entries are placement declarations: when the mode layout opens a same-kind Panel, the presenter binds that Panel to the active resource and places it in the declared target. `workbench.left` means the main left sidenav; `workbench.main.left` remains the main-left workbench area.

History records the domain resource URI (e.g. `dashboard-workbench://ticket/PS-10`) — never an `extension-Panel` wrapper. Companion side panels live in a projection area, not the primary anchor, so they are never recorded as primary history entries.

## Derived Panel metadata

Renderer-only data (which extension Panel to mount, its `webview`, its `extensionId`) is **derived at render time** from the resource kind plus the cached extension manifest — it is never written onto `resource.metadata`, the persisted placement, or the history entry. `ExtensionViewWidget` (`components/extension-Panel-Panel.tsx`) resolves the Panel by matching `extensionViewWidgetId(Panel.id)` against the placement's `contributionId`, and reads `projectId` from the resource's metadata to look the manifest up.

This keeps history identity canonical: first open and Back/Forward replay derive the same Panel from the same Panel id and manifest, with no transient state to carry. The only thing stored on extension resources is domain-adjacent context (`projectId`, `extensionId`).

## Mode-layout Panels and replay

A mode can declare a layout that docks an extension Panel in the primary area (e.g. an extension "overview" via `{ region: "main", panel: "…" }`). These are mounted as `extension-Panel` wrapper resources whose URI (`dashboard-workbench://project/<id>/extension-Panels/<viewId>`) is a stable, canonical identity derived from the Panel id.

Because such a placement lands in the primary anchor, it is recorded as a history landmark. The extensions module registers a **Panel presenter** (`dashboard.extensions.Panel-presenter`) for the `extension-Panel` kind so Back/Forward replay can re-derive the Panel from the manifest and re-place the Panel. Without it, replaying that entry would silently leave the primary area desynced from the history cursor.

Modal Panels are different: they mount in the `overlay` (transient) surface and open via `layout.openPanel`, so they never become primary history entries.

## Project selection and history

Routes are project-scoped. When the selected project is cleared (`projects/module.tsx` `clearSelectedProject`), the workbench history is cleared as well — with no project selected, replaying project-scoped entries would hit the route project guard and strand the history cursor on a Panel that never renders.

## The navigation contract

Every converted root/detail route opts into a shared contract suite, `describeResourceRouteContract` (exported from `pstdio-workbench/testing`). Driving a real `createWorkbenchCore()`, it asserts for each route:

- `root → detail → Back` activates the root; `→ Forward` activates the detail.
- `detail A → detail B → Back` activates detail A.
- the primary area holds exactly one unpinned placement throughout.
- the active primary URI equals the replayed history entry URI.
- the route mode is kept across Back (single-mode routes).

Adding a route means adding its contract block; the suite is the guard that keeps extension navigation resource-first.

## References

- Route helper: `packages/pstdio-dashboard/src/shared/workbench/route-helper.ts`
- Extension resource Panels: `packages/pstdio-dashboard/src/modules/extensions/extension-resource-Panel.ts`
- Extension Panel renderer + derivation: `packages/pstdio-dashboard/src/modules/extensions/components/extension-Panel-Panel.tsx`
- Mode layout + Panel presenter: `packages/pstdio-dashboard/src/modules/extensions/extension-mode-layout.ts`, `module.ts`
- Contract suite: `packages/pstdio-workbench/src/testing/navigation-contract.ts`
- History controller: `packages/pstdio-workbench/src/core/controllers/history/history-controller.ts`
- Related: [Extension Runtime](./extensions-runtime.md)
