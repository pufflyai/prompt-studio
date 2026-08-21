# Workbench API

`@pstdio/workbench` provides the headless workbench model. React hosts, extension
hosts, persistence adapters, and tests use separate entry points.

```ts
import {
  createWorkbenchCore,
  type ResourceRef,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";
```

## Package entry points

| Entry point | Use it for |
| --- | --- |
| `@pstdio/workbench` | Core registries, controllers, contributions, resources, layout, and navigation. |
| `@pstdio/workbench/react` | The React shell, providers, views, and store hooks. |
| `@pstdio/workbench/storage` | Browser-backed persistence adapters. |
| `@pstdio/workbench/extensions` | Mapping checked extension metadata into workbench contributions. |
| `@pstdio/workbench/testing` | Test fixtures and helpers. |
| `@pstdio/workbench/webview-runtime` | The runtime used inside extension webviews. |

## Mental model

- A **resource** is stable domain identity, such as a ticket or workspace.
- A **panel definition** registers a renderer and presentation defaults.
- A **panel instance** is one open placement of a panel definition.
- A **location** is navigation state established from a resource and its presenting Main Panel.
- **Composition** decides which panels are open, addable, closable, and where they may be placed for the active mode and resource.

Panel definitions do not declare location or sub-panel roles. A resource navigation
or resolved composition placement assigns the role at runtime.

## Core services

`createWorkbenchCore()` returns the shared service object. The main namespaces are:

| Namespace | Responsibility |
| --- | --- |
| `layout` | Register panel definitions and manage concrete placements. |
| `composition` | Query open, addable, and closable panels for a panel region. |
| `renderers` | Register React, tree, file, table, controls, and board renderers. |
| `resources` | Register resource kinds, providers, presenters, and hierarchy. |
| `modes` | Register and activate workbench modes. |
| `navigator`, `navigation`, `history`, `breadcrumbs`, `lastResource` | Open targets and maintain navigation state. |
| `commands`, `keybindings`, `commandPalette`, `commandPaletteResources`, `context` | Register, find, and gate user actions. |
| `shell`, `sidePanel`, `panels`, `focus` | Control visible workbench presentation. |
| `preferences`, `settings`, `themes`, `fileIconThemes` | Configure appearance and settings. |
| `notifications`, `terminal` | Show feedback and manage terminal sessions. |
| `host` | Restore snapshots and change persistence scope. |

The core also exposes `getPrimaryResource()` for the resource hosted by the Main
Panel and `getActiveResource()` for the globally focused resource.

## Modules

Group related contributions in a module:

```ts
const ticketsModule: WorkbenchModuleContribution = {
  id: "tickets",
  activate(ctx) {
    // Register contributions and return optional disposables.
  },
};

workbench.registerModule(ticketsModule);
```

The module context applies ownership metadata and tracks registrations. Disposing
the module removes its contributions and open instances.

## Panel definitions and instances

Register the capability to render a panel:

```ts
ctx.layout.registerPanel({
  id: "tickets.editor",
  title: "Ticket",
  region: "main",
  rendererId: "tickets.editor.renderer",
  resourceKinds: ["ticket"],
});
```

Required fields are `id`, `title`, `region`, and `rendererId`. Common optional
fields include:

- `singleton` and `reuse` for instance reuse;
- `mountStrategy` for renderer lifetime;
- `resourceKinds` and `canOpen` for accepted renderer input;
- `eligibleLocations` for supporting panels;
- `panelMenus` for nested left and right Panel Menus;
- `fallbackRegion`, `regionSize`, `tab`, and `floatingPanels` for presentation.

`closable` and `role` are placement state. They are not panel registration fields.
Composition supplies them for extension-owned layouts. A direct host open may set
them explicitly:

```ts
const panel = ctx.layout.openPanel("tickets.editor", {
  resource: ticket,
  closable: false,
  role: "location",
  strategy: { kind: "persistent" },
});

ctx.layout.activatePanel(panel.instanceId);
ctx.layout.updatePanel(panel.instanceId, { title: "Updated title" });
ctx.layout.closePanel(panel.instanceId);
```

### Instance reuse and tab counts

`singleton` and `reuse` control how many instances one panel definition can
open:

| Registration | Instance behavior |
| --- | --- |
| `singleton: true` | Reuses one instance. This is the default. A Sub Panel has one singleton per Location. |
| `singleton: false`, `reuse: "resource"` | Keeps one instance per resource URI. This is the default reuse policy. |
| `singleton: false`, `reuse: "none"` | Creates a new instance for every open call. |

Use `strategy: { kind: "persistent" }` when several tabs must stay open. Without
a strategy, an open in `main`, `secondary`, or `side` becomes a preview tab. A
later preview may replace it.

Open strategies are:

- `{ kind: "persistent", position? }`
- `{ kind: "replace-active" }`
- `{ kind: "replace-panel", instanceId }`
- `{ kind: "preview", position? }`

Without a strategy, an open into `main`, `secondary`, or `side` becomes a preview
tab. The next preview replaces it. Pinned opens and opens into other regions are
persistent.

Panel definition IDs and instance IDs are different. Mutation methods take the
instance ID. Calling `layout.openPanel` directly is presentation-only; it does not
create resource navigation, breadcrumbs, or history.

## Composition queries

Use `composition.panelsFor()` to build region controls without reconstructing
composition rules from layout state:

```ts
const mainPanels = workbench.composition.panelsFor("main");

mainPanels.open; // current WorkbenchWidgetPlacement records
mainPanels.addable; // closed optional panels available in this context
mainPanels.closable; // contribution ids that the user may close
```

The accepted regions are `main`, `secondary`, and `side`. `sidenav` is a docked
composition region, but it is not a tab-hosting `WorkbenchPanelRegion`, so it is
not queried through this controller.

The result follows the active mode and primary resource. If a mode hides a region,
`addable` and `closable` are empty. Required composition placements are open and
not closable. Closed optional placements appear in `addable`.

## Supporting panels

`eligibleLocations` marks a core panel as supporting UI and limits the locations
where it is available:

```ts
ctx.layout.registerPanel({
  id: "tickets.terminal",
  title: "Terminal",
  region: "secondary",
  rendererId: "terminal.renderer",
  eligibleLocations: {
    resourceKinds: ["ticket"],
    modeIds: ["ticket"],
  },
});
```

Eligibility can use `resourceKinds`, `resourceIds`, `modeIds`, or `canOpen`. An
empty object makes the panel supporting UI without adding a filter. Closability is
still decided when the placement opens.

Panel Menus are nested under their owner:

```ts
ctx.layout.registerPanel({
  id: "tickets.editor",
  title: "Ticket",
  region: "main",
  rendererId: "tickets.editor.renderer",
  panelMenus: [
    {
      id: "tickets.properties",
      title: "Properties",
      side: "right",
      rendererId: "tickets.properties.renderer",
    },
  ],
});
```

The active owner instance controls which Panel Menu is visible. Its registration,
resource ownership, placement, and disposal follow the parent panel.

## Resources and navigation

```ts
const ticket: ResourceRef = {
  kind: "ticket",
  uri: "pstdio://ticket/PS-281",
  id: "PS-281",
  label: "PS-281",
};

ctx.resources.registerKind({ kind: "ticket", label: "Ticket", icon: "component" });
ctx.resources.registerPresenter({
  id: "tickets.presenter",
  canOpen: (resource) => resource.kind === "ticket",
  open: (resource, input) =>
    ctx.layout.openPanel("tickets.editor", {
      resource,
      strategy: input.replaceActive ? { kind: "replace-active" } : { kind: "persistent" },
    }),
});

await ctx.resources.openResource(ticket);
```

A presenter opens and returns the panel that presents the resource.
`openResource()` then establishes that panel as the location and updates active
resource state and history.

Use `resources.registerProvider` for browse and search candidates, and
`resources.registerHierarchyProvider` for breadcrumb ancestry.

## Modes

Modes register long-lived contributions in `activate`, seed defaults once for a
new persistence scope, and repair required layout in `reconcile`:

```ts
ctx.modes.registerMode({
  id: "review",
  label: "Review",
  panels: ["main", "secondary", "side"],
  activate: () => undefined,
  seed(modeCtx) {
    modeCtx.layout.openPanel("review.editor", { closable: false });
  },
});
```

Extension hosts generate `seed`, `reconcile`, and `listAddablePanels` from the
declarative composition metadata described below.

## Extension panel placement

Extension panels declare their default placement with `show`. Registration no
longer uses `region`, `closable`, `resourceKind`, or `eligibleLocations`:

```ts
panels: {
  outline: {
    title: "Outline",
    show: {
      for: "ticket",
      region: "sidenav",
      allowedRegions: ["sidenav", "main"],
      required: false,
    },
    renderer: { kind: "tree", id: "outlineTree" },
  },
}
```

`show` may be one placement or an array of placements for different owned
resource kinds. `required: true` makes the resolved placement structural and
non-closable. An optional placement can be closed and restored through Add Panel
when it resolves to `main`, `secondary`, or `side`.

A mode can move an owned panel through `resources.<kind>.panels`, or a mode-wide
panel through `modePanels`. The destination must stay within the panel's declared
`allowedRegions`. This includes moving a panel between `main` and `sidenav` when
both regions are declared.

Use `resourcePanels` only to bind a panel to a resource kind owned by another
extension. The extension host normalizes all of these declarations and lets the
composition resolver own placement and closability.

See the [extension mode guide](../../../../extensions/docs/modes-and-layout.md)
for full recipes and cross-extension slots.

## Shell, persistence, and React

Use `shell` for user-visible presentation:

```ts
ctx.shell.setRegionOpen("secondary", true);
ctx.shell.setRegionSize("secondary", 320);
ctx.shell.setSidePanelPresentation("floating");
```

The application host owns persistence scope:

```ts
workbench.host.setPersistenceScope(scope, {
  carryRegions: ["nav", "sidenav", "side", "status"],
});
```

Render the core from the React entry point:

```tsx
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";

<WorkbenchThemeProvider>
  <Workbench workbench={workbench} />
</WorkbenchThemeProvider>;
```

The [Workbench Storybook](../../../../packages/pstdio-workbench/README.md) has a
dedicated API section with live composition and placement examples.
