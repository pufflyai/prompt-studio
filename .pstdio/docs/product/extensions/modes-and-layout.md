# Extension Modes

Extension modes let an extension register a dashboard workbench mode with optional layout behavior. A mode can seed extension views or known resources and declare that it owns detail chrome for a resource kind.

## Current Shape

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  modes: {
    ticket: {
      id: "planner.ticket",
      label: "Ticket",
      icon: "FileText",
      resourceKind: "ticket",
      layout: {
        open: [{ target: "workbench.left", view: "ticketFiles", pinned: true }],
      },
    },
  },
});
```

## Product Rules

- Mode identity comes from the contribution record.
- `label` is required and is the user-facing name.
- `icon` is optional and should use the dashboard icon naming convention.
- `resourceKind` is optional. When present, dashboard resource openers use the mode for matching resource details.
- `layout.open` seeds a mode scope only when no persisted layout exists. Later activations restore the user's saved placements instead of reopening or clearing them.
- Seed entries can place extension views or resources in `workbench.left`, `workbench.main.left`, `workbench.main`, `workbench.main.right`, or `workbench.secondary`. `workbenchModeLayoutTargets` from `@pstdio/sdk/extensions` is the canonical target vocabulary.
- Targets are checked against that contract when an extension is installed, then checked again against the active frame's `targetable` slots when its mode activates. A target that the frame cannot host reports a mode-layout diagnostic instead of opening in a fallback area.
- Mode-specific visibility belongs in `when.mode` on the UI contribution.

## Resource-Owned Modes

A resource-owned mode is for detail pages, not boards. The dashboard activates the matching mode before opening the primary resource view. Same-kind views still come from `views`, but mode layout declares where mode-owned detail chrome belongs:

- the primary resource view opens in `workbench.main`
- a same-kind view listed in `layout.open` is bound to the active resource and placed in its declared target
- `workbench.left` opens the main left sidebar, while `workbench.main.left` still opens the main-left workbench area
- a `workbench.main.right` companion stays in `main-right` when it is not overridden by mode layout

This keeps a board in project mode while letting a detail page own its sidebar chrome.

## Relationship To UI Contributions

Use the shipped UI contribution surfaces for dashboard placement:

- `routes` for full webview-backed extension pages
- `treeItems` for area-tree entries that open routes, commands, or links
- `commands[].menus` for top action and command palette actions
- `views` for webview panels attached to host-owned targets
- `settingsPanels` for project settings UI

Use `when.mode` to limit visibility to a specific active mode.

## Panel Menu Views

A view can belong to another panel instead of occupying its own workbench target:

```ts
views: {
  ticketEditor: {
    title: "Ticket",
    resourceKind: "ticket",
    fileRenderer: "ticketContent",
  },
  ticketProperties: {
    title: "Properties",
    resourceKind: "ticket",
    controlsRenderer: "ticketProperties",
    menu: {
      host: "ticketEditor",
      side: "right",
      icon: "sliders-horizontal",
    },
  },
}
```

`menu.host` names the local view that owns the menu. `side` chooses the left or right edge, and `icon` is shown in the host panel's trailing tab-strip region only while the menu is detached. A menu view is not a tab and does not create a slot. It receives the same resource as other matching views and follows its host panel when the active tab changes.

Use `target` when a view owns a workbench slot. Use `menu` when the view is panel-owned chrome inside another view.
