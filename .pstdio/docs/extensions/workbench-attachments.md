# Dashboard UI Attachments

Prompt Studio extensions attach dashboard UI to host-owned workbench targets. Targets describe stable host surfaces such as nav actions, the left tree, and settings. Active mode and resource applicability belong in `when`.

Extensions do not create dashboard chrome. They declare contributions, and the dashboard resolves each target into the current workbench layout.

## Core Shape

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    "say-hello": {
      title: "Say hello",
      menus: [
        {
          target: "workbench.nav.actions",
          label: "Say hello",
          icon: "message-circle",
          presentation: "button",
          when: { mode: "project" },
        },
      ],
      async run(ctx, _commandParams) {
        return { target: ctx.attachment?.target, projectId: ctx.projectId };
      },
    },
  },
});
```

`target` is the attachment point. `when` controls visibility and invocation context.

## Implemented Targets

| Target | Kind | Product surface |
| ------ | ---- | --------------- |
| `workbench.nav.actions` | menu | Primary actions in the top workbench chrome. |
| `workbench.nav.overflow` | menu | Overflow actions in the top workbench chrome. |
| `workbench.left.tree` | tree item | Active tree in the left workbench area. |
| `workbench.main.left.tree` | tree item | Active tree in the main-left area. |
| `workbench.main.right.tree` | tree item | Active tree in the main-right area. |
| `workbench.settings` | settings | Extension settings panel. |

Targets are closed and host-owned. A menu cannot target `workbench.left.tree`, and normal contributions cannot attach to bare mode-layout areas such as `workbench.left`.

Panels are not attachments. A panel's optional `show` value declares default placement and allowed movement for its extension's own resource or mode. The active mode can refine that placement. See [Workbench panels](#workbench-panels). Command palette entries are declared on the command itself with `palette`, not with a menu target.

## When Expressions

Dashboard UI contributions can include `when`:

```ts
const workspaceOnly = {
  mode: "workspace",
  resourceType: ["workspace"],
};
```

| Field | Meaning |
| ----- | ------- |
| `mode` | Show only in the active workbench mode or modes. |
| `source` | Apply only for matching command invocation sources. |
| `resourceType` | Show only when the active dashboard resource has a matching type. |
| `metadata` | Show only when active resource metadata contains matching primitive values. |

## Header Action

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    runAttempt: {
      title: "Run attempt",
      cli: true,
      menus: [
        {
          target: "workbench.nav.actions",
          label: "Run attempt",
          icon: "play",
          presentation: "button",
          when: { resourceType: ["ticket"] },
        },
      ],
      async run(ctx, _commandParams) {
        return { ticket: ctx.attachment?.resource?.id ?? ctx.resource?.id };
      },
    },
  },
});
```

Commands invoked from dashboard attachments receive normal command context plus `ctx.attachment`, including `target`, active `mode`, project id, and active resource.

## Command Palette Entry

The command palette is not a menu target. Declare the entry on the command with `palette`:

```ts
palette: {
  group: "Lab",
  label: "Read lab counter",
  icon: "badge-info",
},
```

`palette: true` adds the command with its own title. Use command palette entries for actions that should be discoverable without being pinned into a header.

## Route And Tree Item

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  routes: {
    labPage: {
      path: "lab",
      label: "Lab",
      webview: {
        entry: packageAsset("./src/main.tsx", import.meta.url),
        capabilities: ["commands.execute", "notification.show"],
      },
    },
  },
  treeItems: {
    labPage: {
      target: "workbench.left.tree",
      group: "Lab",
      label: "Lab",
      icon: "flask-conical",
      action: { kind: "view", viewId: "extension-lab.labPage" },
      when: { mode: "project" },
    },
  },
});
```

Routes define webview-backed dashboard pages and register a stable view ID from the package name and route key. Their
`path` values remain deep links. Tree items attach views, commands, resources, or links to host-owned area trees.

## Settings Panel

```ts
settingsPanels: {
  ticketStatuses: {
    title: "Ticket statuses",
    target: "workbench.settings",
    scope: "project",
    webview: {
      entry: packageAsset("./src/settings-panel.tsx", import.meta.url),
      capabilities: ["commands.execute"],
    },
  },
}
```

Settings panels must declare `scope: "project"` or `scope: "global"`. The panel contents remain ordinary extension webviews.

## Status Item

A status item is chrome. The host renders it in the status surface, so it has no region and no saved placement.

```ts
statusItems: {
  buildState: {
    title: "Build",
    when: { mode: "workspace" },
    webview: { entry: packageAsset("./src/build-status.tsx", import.meta.url) },
  },
}
```

## Workbench Panels

A panel declares its title, optional icon, exactly one body, and optional default placement for its extension's own resource or mode.

```ts
panels: {
  ticketEditor: {
    title: "Ticket",
    show: {
      for: "ticket",
      region: "main",
      allowedRegions: ["main", "sidenav"],
      required: true,
    },
    webview: { entry: packageAsset("./src/ticket-editor.tsx", import.meta.url) },
  },
}
```

`show` accepts one placement or an array of placements. Use the array form when the same panel has a different default in more than one owned resource context:

```ts
show: [
  { for: "ticket", region: "main", allowedRegions: ["main", "sidenav"], required: true },
  { for: "project", region: "secondary", allowedRegions: ["secondary", "side"] },
]
```

Each placement has these fields:

- `for` scopes the default to a resource kind owned by the same extension. Omit it for a mode-wide default.
- `region` is the default docked region: `sidenav`, `main`, `secondary`, or `side`.
- `allowedRegions` lists the regions where the user or another mode may keep the panel. It defaults to only `region`.
- `required: true` makes the placement structural and non-closable. Optional placements can be closed and later restored through Add Panel when they resolve to `main`, `secondary`, or `side`.

A slot is a named extension point for panels from other extensions:

```ts
resourceKinds: {
  ticket: {
    surface: "primary",
    slots: {
      primary: { cardinality: "one", external: false },
      inspector: { cardinality: "many", external: true },
    },
  },
}
```

Slots with `external: true` accept panels from other extensions. A contribution from another extension references the kind with the namespaced form:

```ts
resourcePanels: {
  ticketInsights: { resourceKind: "planner.ticket", panel: "insights", slot: "inspector" },
}
```

The active mode's `resources` recipe may move owned panels and place cross-extension slots. `modePanels` applies the same rules to mode-wide panels. A recipe can move a panel only within its declared `allowedRegions`. See [Extension modes](./modes-and-layout.md).

## Panel Placement

The mode recipe decides regions. Inside a region, two panels in the same slot use stable contribution declaration order until the user reorders them. A saved user tab order is not reset on contribution refresh, and restoring a required placement does not reset optional placements or tab order.

Panel menus and other item contributions can still set `placement: "first" | "default" | "last"` for relative order among siblings; entries with the same placement use declaration order.

## Diagnostics

Invalid UI attachments are reported by extension checks and runtime diagnostics:

| Problem | Expected diagnostic |
| ------- | ------------------- |
| Unknown target id | `extension_target_invalid`. |
| Target used by the wrong contribution kind | `extension_target_unsupported`. |
| Missing settings scope | `extension_settings_scope_invalid`. |
| Panel placement has an invalid shape | `extension_panel_contract_invalid`. |
| Invalid slot, kind, panel, or placement in composition | `extension_resource_kind_missing`, `extension_resource_slot_missing`, `extension_resource_slot_closed`, `extension_panel_missing`, `extension_panel_placement_unresolvable`, `extension_mode_resource_unsupported`, `extension_placement_required_invalid`, or `extension_resource_primary_invalid`. |
| Missing package asset | Webview, template, skill, theme, or icon source cannot be loaded. |

Diagnostics include the extension id, package path, contribution id, requested target, expected kind, and supported alternatives when applicable.
