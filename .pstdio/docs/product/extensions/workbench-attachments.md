# Dashboard UI Attachments

Prompt Studio extensions attach dashboard UI to host-owned slots. Slots are the implemented product contract for menu buttons, command palette entries, navigation items, views, settings panels, and renderers.

Extensions do not create dashboard chrome. They declare contributions, and the dashboard decides how each slot is rendered.

## Core Shape

```ts
import { defineExtension, projectSlots } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    "say-hello": {
      title: "Say hello",
      menus: [
        {
          slot: projectSlots.headerPrimary,
          label: "Say hello",
          icon: "message-circle",
          presentation: "button",
        },
      ],
      async run(ctx) {
        return { projectId: ctx.projectId };
      },
    },
  },
});
```

`slot` is required for current menu, navigation, view, settings panel, and renderer contributions.

## Implemented Slots

| Slot | Kind | Product surface |
| ---- | ---- | --------------- |
| `projectSlots.sidebarNav` | navigation | Project sidebar navigation. |
| `projectSlots.sidebar` | view | Project sidebar view area. |
| `projectSlots.headerPrimary` | menu | Primary project header actions. |
| `projectSlots.headerOverflow` | menu | Project header overflow menu. |
| `projectSlots.commandPanel` | menu | Dashboard command palette / command panel. |
| `projectSlots.settingsPanels` | settings | Project settings panels. |
| `ticketSlots.headerPrimary` | menu | Primary ticket actions. |
| `ticketSlots.headerOverflow` | menu | Ticket overflow actions. |
| `workspaceSlots.headerPrimary` | menu | Primary workspace actions. |
| `workspaceSlots.headerOverflow` | menu | Workspace overflow actions. |
| `workspaceSlots.tabs` | navigation | Workspace tab navigation. |
| `workspaceSlots.sidebar` | view | Workspace sidebar views. |
| `sessionSlots.headerPrimary` | menu | Primary session actions. |
| `sessionSlots.headerOverflow` | menu | Session overflow actions. |
| `sessionSlots.transcriptActions` | menu | Session transcript actions. |

The slot kind must match the contribution. A menu contribution cannot attach to a view slot, and a settings panel cannot attach to a menu slot.

## When Expressions

Dashboard UI contributions can include `when`:

```ts
const labRouteOnly = {
  resourceType: ["extension-route"],
  metadata: { extensionId: "pstdio.extension-lab", routePath: "lab" },
};
```

| Field | Meaning |
| ----- | ------- |
| `source` | Show or apply only for matching command invocation sources. |
| `resourceType` | Show only when the active dashboard resource has a matching type. |
| `metadata` | Show only when active resource metadata contains matching primitive values. |

Current `when` expressions do not include active mode filtering.

## Header Action

```ts
import { defineExtension, ticketSlots } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    runAttempt: {
      title: "Run attempt",
      cli: true,
      menus: [
        {
          slot: ticketSlots.headerPrimary,
          label: "Run attempt",
          icon: "play",
          presentation: "button",
        },
      ],
      async run(ctx) {
        return { ticket: ctx.resource?.id };
      },
    },
  },
});
```

Commands invoked from dashboard slots receive normal command context, including project id, source, active resource, params, storage, notifications, and other extension APIs.

## Command Panel Entry

```ts
menus: [
  {
    slot: projectSlots.commandPanel,
    group: "Lab",
    label: "Read lab counter",
    icon: "badge-info",
  },
];
```

Use command panel entries for actions that should be discoverable without being pinned into a header.

## Route And Navigation

```ts
import { defineExtension, packageAsset, projectSlots } from "@pstdio/sdk/extensions";

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
  navigation: {
    labPage: {
      slot: projectSlots.sidebarNav,
      group: "Lab",
      label: "Lab",
      icon: "flask-conical",
      route: "lab",
    },
  },
});
```

Routes define webview-backed dashboard pages. Navigation attaches those routes, commands, or external links to host navigation slots.

## Settings Panel

```ts
settingsPanels: {
  ticketStatuses: {
    title: "Ticket statuses",
    slot: projectSlots.settingsPanels,
    webview: {
      entry: packageAsset("./src/settings-panel.tsx", import.meta.url),
      capabilities: ["commands.execute"],
    },
  },
}
```

Settings panels are webviews rendered inside dashboard settings. They should request only the webview capabilities they need.

## Views And Renderers

Views attach webview-backed panels to view slots such as `projectSlots.sidebar` or `workspaceSlots.sidebar`. Renderers attach webviews to supported renderer slots and declare the record type they render with `for`.

Use routes for full extension pages, views for embedded dashboard panels, and renderers when the host asks an extension to render a known record type.

## Diagnostics

Invalid UI attachments should be reported by extension checks and runtime diagnostics:

| Problem | Expected diagnostic |
| ------- | ------------------- |
| Missing slot | Contribution cannot be mounted. |
| Wrong slot kind | Contribution type does not match slot kind. |
| Unknown slot id | Host cannot resolve the attachment point. |
| Missing package asset | Webview, template, skill, theme, or icon source cannot be loaded. |

Diagnostics should include the extension id when known, the package path, and the contribution id.
