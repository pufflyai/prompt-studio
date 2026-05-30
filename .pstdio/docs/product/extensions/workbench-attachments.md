# Dashboard UI Attachments

Prompt Studio extensions attach dashboard UI to host-owned workbench targets. Targets describe stable host surfaces such as top actions, command palette, left tree, and settings. Active mode and resource applicability belong in `when`.

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
          target: "workbench.top.actions",
          label: "Say hello",
          icon: "message-circle",
          presentation: "button",
          when: { mode: "project" },
        },
      ],
      async run(ctx) {
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
| `workbench.top.actions` | menu | Primary top workbench actions. |
| `workbench.top.overflow` | menu | Top workbench overflow actions. |
| `workbench.commandPalette` | menu | Dashboard command palette. |
| `workbench.left.tree` | tree item | Active tree in the left workbench area. |
| `workbench.main.left.tree` | tree item | Active tree in the main-left area. |
| `workbench.main.right.tree` | tree item | Active tree in the main-right area. |
| `workbench.main` | view | Direct extension view in the main area. |
| `workbench.main.left` | view | Direct extension view in the main-left area. |
| `workbench.main.right` | view | Direct extension view in the main-right area. |
| `workbench.main.bottom` | view | Direct extension view in the main-bottom area. |
| `workbench.settings` | settings | Extension settings panel. |

Targets are closed and host-owned. A menu cannot target `workbench.left.tree`, and normal contributions cannot attach to bare mode-layout areas such as `workbench.left`.

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
          target: "workbench.top.actions",
          label: "Run attempt",
          icon: "play",
          presentation: "button",
          when: { resourceType: ["ticket"] },
        },
      ],
      async run(ctx) {
        return { ticket: ctx.attachment?.resource?.id ?? ctx.resource?.id };
      },
    },
  },
});
```

Commands invoked from dashboard attachments receive normal command context plus `ctx.attachment`, including `target`, active `mode`, project id, and active resource.

## Command Palette Entry

```ts
menus: [
  {
    target: "workbench.commandPalette",
    group: "Lab",
    label: "Read lab counter",
    icon: "badge-info",
  },
];
```

Use command palette entries for actions that should be discoverable without being pinned into a header.

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
      action: { kind: "route", route: "lab" },
      when: { mode: "project" },
    },
  },
});
```

Routes define webview-backed dashboard pages. Tree items attach those routes, commands, or links to host-owned area trees.

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

## Diagnostics

Invalid UI attachments are reported by extension checks and runtime diagnostics:

| Problem | Expected diagnostic |
| ------- | ------------------- |
| Unknown target id | `extension_target_invalid`. |
| Target used by the wrong contribution kind | `extension_target_unsupported`. |
| Missing settings scope | `extension_settings_scope_invalid`. |
| Missing package asset | Webview, template, skill, theme, or icon source cannot be loaded. |

Diagnostics include the extension id, package path, contribution id, requested target, expected kind, and supported alternatives when applicable.
