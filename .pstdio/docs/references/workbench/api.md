# Workbench API

Use the package root for core contracts:

```ts
import {
  createWorkbenchCore,
  type ResourceRef,
  type WorkbenchModuleContribution,
  type WorkbenchPanelInstance,
} from "@pstdio/workbench";
```

React hosts import from `@pstdio/workbench/react`, persistence adapters from
`@pstdio/workbench/storage`, extension adapters from
`@pstdio/workbench/extensions`, and test helpers from
`@pstdio/workbench/testing`.

## Mental model

- **Resource** — stable domain identity such as a ticket, workspace, or settings page.
- **Panel definition** — a registered renderer and its presentation defaults.
- **Panel instance** — one open placement of a Panel definition.
- **Location** — navigation state established from a Resource and its presenting Main Panel.

Panels are not declared as Locations. A successful Resource navigation creates
the relationship at runtime.

## Modules

```ts
const ticketsModule: WorkbenchModuleContribution = {
  id: "tickets",
  activate(ctx) {
    // Register contributions and return optional disposables.
  },
};

workbench.registerModule(ticketsModule);
```

The module context tracks registrations and subscriptions under the module
owner. Disposing the module removes its contributions and open instances.

## Panels

Register every UI surface with `layout.registerPanel`:

```ts
ctx.layout.registerPanel({
  id: "tickets.editor",
  title: "Ticket",
  region: "main",
  rendererId: "tickets.editor.renderer",
  closable: false,
  resourceKinds: ["ticket"],
});
```

Required fields are `id`, `title`, `region`, `rendererId`, and `closable`.
Important optional fields include:

- `singleton` and `reuse` for instance reuse;
- `mountStrategy` for renderer lifetime;
- `resourceKinds` and `canOpen` for accepted renderer input;
- `eligibleLocations` for supporting Panels;
- `panelMenus` for nested left/right Panel Menus;
- `fallbackRegion`, `regionSize`, `tab`, and `floatingPanels` for presentation.

Open operations return the actual instance:

```ts
const panel = ctx.layout.openPanel("tickets.editor", {
  resource: ticket,
  strategy: { kind: "persistent" },
});

ctx.layout.activatePanel(panel.instanceId);
ctx.layout.updatePanel(panel.instanceId, { title: "Updated title" });
ctx.layout.closePanel(panel.instanceId);
```

Open strategies are:

- `{ kind: "persistent", position? }`
- `{ kind: "replace-active" }`
- `{ kind: "replace-panel", instanceId }`
- `{ kind: "preview", position? }`

Without a strategy, an open into a tab-hosting region (`main`, `secondary`,
`side`) lands as a preview tab that the next preview replaces. Pinned opens and
opens into any other region are persistent. Ask for `{ kind: "persistent" }`
when a tab must stay put.

Panel definition IDs and Panel instance IDs are intentionally different.
Mutation methods take the instance ID.

Calling `layout.openPanel` directly is presentation-only. It does not change
Location, breadcrumbs, history, or resource persistence scope.

### Supporting Panels

Panels without `eligibleLocations` are full content Panels. They can present a
Resource and become a Location when opened through `resources.openResource`.

`eligibleLocations` explicitly makes a Panel subordinate. A subordinate Panel is
shown as supporting UI, usually a closable tab, for matching Locations:

```ts
ctx.layout.registerPanel({
  id: "tickets.terminal",
  title: "Terminal",
  region: "secondary",
  rendererId: "terminal.renderer",
  closable: true,
  eligibleLocations: {
    resourceKinds: ["ticket"],
    modeIds: ["ticket"],
  },
});
```

Eligibility can use `resourceKinds`, `resourceIds`, `modeIds`, or `canOpen`.
The field controls availability and ownership only. `resourceKinds`,
`closable`, and `region` never imply Location.

An empty object is valid, but it has two effects: it makes the Panel subordinate
and adds no eligibility constraints. That means the Panel is eligible in every
matching location:

```ts
ctx.layout.registerPanel({
  id: "tickets.notes",
  title: "Notes",
  region: "secondary",
  rendererId: "notes.renderer",
  closable: true,
  eligibleLocations: {},
});
```

Use `eligibleLocations` only when the Panel is intended to be supporting UI.

### Panel Menus

Menus are nested under their owner:

```ts
ctx.layout.registerPanel({
  id: "tickets.editor",
  title: "Ticket",
  region: "main",
  rendererId: "tickets.editor.renderer",
  closable: false,
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

The active owner instance controls which menu is visible. Registration,
placement, resource ownership, and disposal follow the parent Panel.

## Kanban renderers

A kanban renderer is a Notion/Linear-style data workspace registered under
`renderers`. It contributes an attribute schema, data via
`executeQuery(state)`, row-mutation callbacks, and optional initial views. Each
saved view captures filters and display settings; selection, scroll position,
and collapsed groups remain transient.

Like tree renderers, a kanban renderer auto-registers a Panel renderer with the
same id. Register and open a Panel to place the workspace:

```ts
ctx.renderers.registerKanbanRenderer({
  id: "tickets",
  title: "Tickets",
  resourceKind: "ticket",
  attributes: [/* ... */],
  defaultViews: [/* ... */],
  defaultActiveViewId: "all",
  executeQuery: ({ settings, filters }) => fetchRows(settings, filters),
  onRowClick: (row) => {/* ... */},
});

ctx.layout.registerPanel({
  id: "tickets",
  title: "Tickets",
  region: "main",
  rendererId: "tickets",
  closable: false,
});

ctx.layout.openPanel("tickets");
```

## Resources and navigation

```ts
const ticket: ResourceRef = {
  kind: "ticket",
  uri: "pstdio://ticket/example-ticket",
  id: "example-ticket",
  label: "Example ticket",
};

ctx.resources.registerKind({
  kind: "ticket",
  label: "Ticket",
  icon: "component",
});

ctx.resources.registerPresenter({
  id: "tickets.presenter",
  canOpen: (resource) => resource.kind === "ticket",
  open: (resource, input) =>
    ctx.layout.openPanel("tickets.editor", {
      resource,
      strategy: input.replaceActive
        ? { kind: "replace-active" }
        : { kind: "persistent" },
    }),
});

const locationPanel = await ctx.resources.openResource(ticket);
```

A presenter's responsibility is narrow: open and return the Panel that presents
the Resource. It does not decide whether that Panel is a Location or write
navigation history. `openResource` chooses the highest-priority matching
presenter and, after it succeeds, establishes the returned Panel as the
Location. Navigation history and active-resource state follow that transaction.

Use `resources.registerProvider` for browse/search candidates and
`resources.registerHierarchyProvider` for breadcrumb ancestry.

## Modes

Modes register long-lived contributions in `activate`, seed default placements
once per persistence scope in `seed`, and attach active behavior in `enter`.

```ts
ctx.modes.registerMode({
  id: "review",
  label: "Review",
  panels: ["main", "secondary"],
  activate: () => undefined,
  seed(modeCtx) {
    modeCtx.layout.openPanel("review.editor");
    modeCtx.layout.openPanel("review.checks");
  },
});
```

The first Main Panel opened while seeding becomes the mode Location before
later supporting Panels open.

## Shell and host boundaries

Use `shell` for user-visible region presentation:

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

Module code should not restore raw layout snapshots or coordinate multiple
stores. The host boundary changes resource scope atomically; the shell service
changes presentation atomically.

## Extensions

Extension manifests use `panels` with the same fields: explicit `region` and
`closable`, optional `resourceKind` and `eligibleLocations`, plus nested
`panelMenus`. They do not declare `location`, `sub-panel`, or `panel-menu`
roles. The host normalizes extension metadata through `registerPanel`.
