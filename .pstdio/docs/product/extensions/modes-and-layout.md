# Extension Modes

Extension modes are currently lightweight dashboard metadata. An extension can contribute a mode id, label, and optional icon so the dashboard can list or register the mode alongside other extension UI metadata.

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
- Modes do not currently declare layout, reset regions, opened views, or active-mode `when` filters.

## Relationship To UI Contributions

Use the shipped UI contribution surfaces for actual dashboard placement:

- `routes` for full webview-backed extension pages
- `navigation` for sidebar entries that open routes, commands, or links
- `commands[].menus` for header and command panel actions
- `views` for webview panels in host view slots
- `settingsPanels` for project settings UI

If a mode needs a page or panel today, model that UI through routes, navigation, menus, and slots.
