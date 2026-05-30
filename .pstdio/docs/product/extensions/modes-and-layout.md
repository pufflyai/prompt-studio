# Extension Modes

Extension modes are currently lightweight workbench metadata. An extension can contribute a mode id, label, and optional icon so the dashboard can list or register the mode alongside other extension UI metadata.

The implemented extension API does not support declarative mode layout reset/open behavior yet.

## Current Shape

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  modes: {
    sessions: {
      id: "sessions",
      label: "Sessions",
      icon: "message-circle",
    },
  },
});
```

## Product Rules

- Mode identity comes from the contribution record.
- `id` is required in the current SDK type.
- `label` is required and is the user-facing name.
- `icon` is optional and should use the dashboard icon naming convention.
- Modes do not currently declare layout, reset regions, or opened views.
- Mode-specific visibility belongs in `when.mode` on the UI contribution.

## Relationship To UI Contributions

Use the shipped UI contribution surfaces for actual dashboard placement:

- `routes` for full webview-backed extension pages
- `treeItems` for area-tree entries that open routes, commands, or links
- `commands[].menus` for top action and command palette actions
- `views` for webview panels attached to host-owned targets
- `settingsPanels` for project settings UI

If a mode needs a page or panel today, model that UI through routes, tree items, menus, and targets. Use `when.mode` to limit visibility to a specific active mode.
