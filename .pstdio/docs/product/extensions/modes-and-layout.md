# Extension Modes

Extension modes let an extension register a dashboard workbench mode with optional layout behavior. A mode can reset workbench areas, open extension views or known resources, and declare that it owns detail chrome for a resource kind.

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
        reset: true,
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
- `layout.reset: true` clears all mode-layout areas before opening mode content. A reset array can target specific areas.
- `layout.open` can place extension views or resources in `workbench.left`, `workbench.main.left`, `workbench.main`, `workbench.main.right`, or `workbench.secondary`.
- Mode-specific visibility belongs in `when.mode` on the UI contribution.

## Resource-Owned Modes

A resource-owned mode is for detail pages, not boards. The dashboard activates the matching mode before opening the primary resource view. Same-kind views still come from `views`, but mode layout declares where mode-owned detail chrome belongs:

- the primary resource view opens in `workbench.main`
- a same-kind view listed in `layout.open` is bound to the active resource and placed in its declared target
- `workbench.left` opens the main left sidenav, while `workbench.main.left` still opens the main-left workbench area
- a `workbench.main.right` companion stays in `main-right` when it is not overridden by mode layout

This keeps a board in project mode while letting a detail page own its sidenav chrome.

## Relationship To UI Contributions

Use the shipped UI contribution surfaces for dashboard placement:

- `routes` for full webview-backed extension pages
- `treeItems` for area-tree entries that open routes, commands, or links
- `commands[].menus` for top action and command palette actions
- `views` for webview panels attached to host-owned targets
- `settingsPanels` for project settings UI

Use `when.mode` to limit visibility to a specific active mode.
