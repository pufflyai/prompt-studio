# pstdio-workbench API

`pstdio-workbench` is the workbench framework used by the dashboard. It exposes a contribution model on a typed core plus React components for rendering that model.

## Imports

```ts
import { createWorkbenchCore } from "pstdio-workbench/core";
import type {
  ResourceRef,
  WorkbenchArea,
  WorkbenchModuleContribution,
} from "pstdio-workbench/core";
import { Workbench } from "pstdio-workbench/react";
```

The package exports:

| Import               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `pstdio-workbench`       | Core API re-export                                   |
| `pstdio-workbench/core`  | Registries, controllers, layout model, resources     |
| `pstdio-workbench/react` | Workbench, widget host, workbench UI components          |

## Core

Create one workbench core per workbench instance:

```ts
const workbench = createWorkbenchCore({
  layoutPersistence,
  preferencePersistence,
  treePersistence,
  panelsPersistence,
  initialSessionPanelMode: "attached",
});
```

`createWorkbenchCore()` returns registries and controllers used by workbench modules and host-mapped runtime extensions:

| Slot              | Kind       | Use                                                                  |
| ----------------- | ---------- | -------------------------------------------------------------------- |
| `breadcrumbs`     | controller | Current breadcrumb items                                             |
| `commandPalette`  | controller | Open, close, toggle, and observe the command palette                 |
| `commands`        | registry   | Command definitions, handlers, and execution error events            |
| `context`         | service    | Context keys used by menus and keybindings                           |
| `history`         | controller | In-memory editor/view navigation history                              |
| `keybindings`     | registry   | Keyboard shortcuts backed by commands                                |
| `layout`          | registry   | Widget contributions, placeholders, and widget placements       |
| `menus`           | registry   | Menu actions backed by commands                                      |
| `modes`           | registry   | Mode-specific contribution activation                                |
| `navigation`      | registry   | Location parsing plus resource, view, command, and compound dispatch |
| `notifications`   | registry   | Toast-style workbench notifications                                      |
| `panels`          | controller | Side-panel open/close state per area                                 |
| `preferences`     | registry   | Typed preference schemas and values                                  |
| `renderers`       | registry   | Widget renderers keyed by `rendererId`                               |
| `resources`       | registry   | Resource kinds and resource openers                                  |
| `sessionPanel`    | controller | Session panel mode (`attached`, `bubble`, `closed`)                  |
| `trees`           | registry   | Tree view contributions, sections, and state                         |

## Workbench Modules

A workbench module receives the same registries and controllers as the workbench core. Registrations made through the module context are tagged with module metadata and disposed together.

```ts
const projectModule: WorkbenchModuleContribution = {
  id: "project",
  activate(ctx) {
    ctx.commands.registerCommand(
      { id: "project.refresh", label: "Refresh project" },
      { execute: () => refreshProject() },
    );
  },
};

const disposable = workbench.registerModule(projectModule);
```

`activate()` can return extra disposables for subscriptions or custom cleanup. Registry registrations made through the module context are tracked automatically. The same module can later be removed with `workbench.unregisterModule(moduleId)`.

## Layout And Widgets

Widgets are contributed with `layout.registerWidget()` and opened with `layout.openWidget()`.

```ts
ctx.layout.registerWidget({
  id: "project.details",
  title: "Details",
  area: "main-right",
  areaSize: { defaultPx: 320, minPx: 240, maxPx: 520 },
  areaCollapsible: false,
  singleton: true,
  resourceKinds: ["project"],
  rendererId: "project.details",
  config: { density: "compact" },
});
```

Available areas are `nav`, `activity`, `left-header`, `left`, `main-header`, `main-left`, `main`, `main-right`, `secondary-header`, `secondary`, `status`, `overlay`, `floating-header`, and `floating`. The side regions `main-left` and `main-right` are headerless; their header lives at the area level.

Widget options:

| Option               | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `area`               | Primary workbench area for the widget                                         |
| `fallbackArea`       | Alternate area for callers that do not provide one                        |
| `singleton`          | Reuse one existing placement instead of adding more placements            |
| `closable`           | Whether placements expose a close affordance in area tabs                 |
| `areaSize`           | Active widget size hints for resizable areas                              |
| `areaCollapsible`    | Whether the active widget allows its area to collapse; defaults to `true` |
| `headerBorderBottom` | Whether widgets in a `*-header` area draw the default bottom border       |
| `resourceKinds`      | Resource kinds the widget is intended to display                          |
| `rendererId`         | Required renderer registration id                                         |
| `config`             | Opaque renderer-owned widget configuration                                |
| `canOpen`            | Optional resource predicate                                               |

`areaSize` supports `defaultPx`, `minPx`, and `maxPx`. The workbench resolves size, collapsibility, and header border behavior from the active widget in an area.

Register a placeholder when an area needs an empty state after all widget placements close:

```ts
ctx.layout.registerPlaceholder({
  id: "project.empty-main",
  title: "Empty main",
  area: "main",
  rendererId: "project.empty-main",
});
```

Placeholders render only while their area has no widget placements. They are not opened with `openWidget()`, are not persisted in the layout, and do not appear in area tabs.

Open widgets with append-or-replace behavior:

```ts
ctx.layout.openWidget("project.details", {
  resource,
  title: resource.label,
  replaceActive: true,
});
```

`replaceActive: true` replaces the active, unpinned placement in the target area. When omitted, the workbench adds another placement unless the widget is `singleton`. Pinned and closable flags can also be passed per call.

Set a layout persistence scope when the same workbench shell should remember layout independently per project, workspace, or other namespace:

```ts
workbench.layout.setPersistenceScope(`project:${projectId}`);
```

Switching scopes flushes the outgoing layout through the persistence adapter before loading the incoming scoped layout. Call `layout.getPersistenceScope()` to inspect the current scope.

## Surfaces: Anchors And Projections

Areas have a behavioural role in the resource-projected model:

| Role           | Areas                                                   | Meaning                                                              |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| **anchor**     | `main` (primary), `secondary`, `floating` (attached)    | Hosts one active resource.                                          |
| **projection** | `main-left`, `main-right`, the `*-header` areas, `nav`, `status`, `left` | Renders an anchor's resource; owns nothing.        |
| **chrome**     | `activity`                                              | Frame UI; resource-blind.                                          |
| **transient**  | `overlay`                                               | Ephemeral layer (command palette, dialogs, scoped pickers).        |

`main` is the **primary** anchor — the active subject. `getPrimaryResource()` returns it (scoped to `main`, unlike `getActiveResource()`, which is the globally last-activated widget), and `onDidChangePrimaryResource(listener)` fires when it changes. Projections follow the primary; `nav` (breadcrumbs + session status) and `status` read both `primary` and `attached`.

The two secondary anchors carry a resource that relates to the primary:

- `secondary` is **derived** — its content re-scopes (clears) when the primary changes (e.g. a workspace's terminals).
- `floating` is **attached** — its content **detaches** and persists across primary navigation, but **disconnects when it leaves the new primary's scope**.

A built-in coordinator reconciles these anchors on every primary change. It only acts on resource-bearing placements, so a plain (resourceless) widget parked in a side anchor is left untouched. Inject a custom scope predicate with `createWorkbenchCore({ isInScope })`; the default derives scope from the registered resource providers.

## Keep-Alive Renderers

Mark a renderer `keepAlive: true` for UI subtrees that must survive moving between workbench areas, such as a streaming session chat moving between attached and bubble modes. Every widget that uses the renderer shares a single persistent subtree; React never re-mounts it across area moves.

```tsx
ctx.renderers.registerRenderer({
  id: "session-chat",
  keepAlive: true,
  render: () => <SessionChatView />,
});

ctx.layout.registerWidget({
  id: "session-chat-attached",
  title: "Session Chat",
  area: "main-right",
  singleton: true,
  rendererId: "session-chat",
});

ctx.layout.registerWidget({
  id: "session-chat-bubble",
  title: "Session Chat",
  area: "floating",
  singleton: true,
  rendererId: "session-chat",
});
```

The React layer mounts the kept-alive subtree once in `WorkbenchKeepAliveLayer`. Each `WorkbenchWidgetHost` mounted for a kept-alive renderer claims the host into its frame, preserving React state, focus, scroll, and in-flight effects while the subtree moves.

Kept-alive renderers receive no `WorkbenchWidgetRenderInput` from their `render` function (the subtree is constructed once). When the subtree needs per-widget information — current widget id, placement, config — call `useWorkbenchClaim()` inside the kept-alive tree:

```tsx
const SessionChatView = () => {
  const claim = useWorkbenchClaim();
  const variant = claim?.widget.id === "session-chat-bubble" ? "bubble" : "attached";
  return <Chat variant={variant} />;
};
```

`useWorkbenchClaim()` returns the current claim's `WorkbenchWidgetRenderInput`, or `undefined` when no widget has the host claimed. It re-renders the subtree (without re-mounting) when the claim moves from one widget to another.

## Resources

Resources are the navigation and opening contract between trees, links, and widgets.

```ts
ctx.resources.registerKind({
  kind: "session",
  label: "Session",
  icon: "MessageCircle",
  surface: "attached", // routes to the floating (attached) anchor; `secondary` and `primary` are the others
});

ctx.resources.registerOpener({
  id: "project.details",
  priority: 10,
  canOpen: (resource) => resource.kind === "project",
  open: (resource, input) =>
    ctx.layout.openWidget("project.details", {
      resource,
      title: resource.label,
      replaceActive: input.replaceActive,
    }),
});
```

```ts
type ResourceRef = {
  kind: string;
  uri: string;
  id?: string;
  label?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
};
```

Use the standard resource icon names for common workbench concepts:

| Concept       | Icon                      |
| ------------- | ------------------------- |
| Project       | `folder-root`             |
| Workspace     | `computer`                |
| Worktree      | `git-pull-request-draft`  |
| Ticket        | `component`               |
| Data renderer | `square-kanban`           |
| Settings      | `settings`                |

Call `resources.openResource(resource, { replaceActive: true })` to route through the highest-priority opener whose `canOpen()` returns true. A kind's `surface` (`primary` | `secondary` | `attached`) declares which anchor it belongs to; `resources.getSurface(resource)` reads it, and `resolveAnchorArea(surface)` maps it to an area so openers do not hardcode one.

Providers list the candidates a surface can open, scoped to the active primary. `list(query, context)` receives `context.primary`, so a session/terminal provider can return only the children of the active workspace:

```ts
ctx.resources.registerProvider({
  id: "workspace.sessions",
  kind: "session",
  list: (_query, context) => sessionsForWorkspace(context.primary?.uri).map((resource) => ({ resource })),
});
```

This scoping is what drives the detached-disconnect behaviour: when the primary changes, a `floating` session that the new primary's provider no longer lists falls out of scope and is disconnected.

> Only one opener runs for a resource. If multiple openers match the same resource, the lower-priority openers are unreachable through `openResource()`;
> equal priorities fall back to opener id sorting. Use one generic opener for the default view, and use narrower `canOpen()` predicates or direct
> `layout.openWidget()` calls for alternate views like details panels.

## Navigation

Navigation parsers convert ingress URLs into typed targets:

```ts
ctx.navigation.registerParser({
  id: "project-open",
  canParse: (location) => location.startsWith("pstdio://open"),
  parse: () => ({
    kind: "compound",
    targets: [
      { kind: "resource", resource: { kind: "ticket", uri: "ticket:PS-200", id: "PS-200" } },
      { kind: "view", widgetId: "workspace-tree" },
    ],
  }),
});
```

`navigation.resolveLocation(location)` returns `NavigationTarget`, which can be `resource`, `view`, `command`, or `compound`. `navigation.openTarget(target)` dispatches the target through existing workbench APIs, and `navigation.navigate(location)` resolves then dispatches. Compound targets are validated before dispatch and rolled back through a dispatcher checkpoint if a later item throws, so a deep link does not partially open an earlier item when the full navigation cannot complete.

## Renderers

Renderers are registered in their own registry. `WorkbenchWidgetHost` resolves `widget.rendererId` against `workbench.renderers` and calls the registered renderer with the widget, placement, workbench, and refresh callback.

```tsx
ctx.renderers.registerRenderer({
  id: "project.details",
  render: ({ workbench, placement, refresh }) => (
    <ProjectDetails
      workbench={workbench}
      resource={placement.resource}
      onRefresh={refresh}
    />
  ),
});
```

Renderer input includes `workbench`, the registered `widget`, the concrete `placement`, and a `refresh()` callback.

Webview rendering lives in `pstdio-extensions/workbench`, which exposes a bridge renderer that hosts can register with `workbench.renderers` and reference by `rendererId` on widget contributions.

## Commands, Menus, And Keybindings

Commands are the executable primitive. Menus and keybindings must reference a registered command.

```ts
import {
  headerLeadingMenuPath,
  headerTrailingMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-workbench/core";

ctx.commands.registerCommand(
  { id: "project.refresh", label: "Refresh", icon: "RefreshCw" },
  {
    execute: () => refreshProject(),
    isEnabled: () => true,
  },
);

ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
  commandId: "project.refresh",
  order: 10,
});

ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
  commandId: "project.refresh",
  order: 10,
});

ctx.layout.registerMenuItem(headerLeadingMenuPath("main"), {
  commandId: "project.refresh",
  order: 10,
});

ctx.keybindings.registerKeybinding({
  commandId: "project.refresh",
  keybinding: "mod+e",
  when: "project.active",
});
```

`headerLeadingMenuPath(area)` and `headerTrailingMenuPath(area)` return the menu paths the workbench reads when it renders the leading and trailing slots of an area header. Context expressions support truthy keys, negation, equality, inequality, and `&&`, for example `project.active && !dialog.open`.

Subscribe to execution failures with `workbench.commands.onDidExecuteError(listener)` to surface errors or instrument analytics.

### Reserved chord policy

Built-in workbench shortcuts and extension contributions share a single reserved-chord table maintained in `pstdio-extensions`. Chords claimed by browsers, OSes, or developer tooling — `Mod+T`, `Mod+W`, `Mod+R`, `Mod+P`, `Mod+S`, `Mod+Shift+P`, `Mod+Shift+I`, `F5`, `F11`, `F12`, and similar — must not be used as defaults. Prefer `Mod+...` (Cmd on macOS, Ctrl on Windows/Linux) and make sure multi-step chords do not use an existing single-step shortcut as their prefix.

The extension runtime emits a `reserved_keybinding_chord` warning when a contributed `key`, `mac`, `linux`, or `win` override matches the reserved table, and the workbench built-in tests assert their own defaults pass the same check. Use `findReservedKeybindingConflict` from `pstdio-extensions` if you need to validate a chord at runtime.

## Tree renderers

A tree renderer is a tree-shaped renderer registered under `renderers`. It exposes:

- `getBody(ctx)` — required, returns `TreeViewSection[]` (the body's grouped nodes).
- `getFooter(ctx)` — optional, returns `TreeNode[]` rendered as a compact sticky footer.
- `getChildren(node, ctx)` — lazy children for any node.

Registering a tree renderer auto-registers a widget renderer with the same id, so widgets can place the tree through `layout.registerWidget({ rendererId: <tree id> })` and `layout.openWidget(<tree id>)`. Sizing and area are owned by the widget, not the tree.

```ts
ctx.renderers.registerTreeRenderer({
  id: "project.tree",
  title: "Project",
  getBody: () => [
    {
      id: "current",
      nodes: [
        {
          id: "current-project",
          label: "Current project",
          icon: "Folder",
          resource: {
            kind: "project",
            uri: "project:current",
            label: "Current project",
          },
        },
      ],
    },
  ],
  getFooter: () => [{ id: "settings", label: "Settings", icon: "Settings" }],
  getChildren: () => [],
});

ctx.layout.registerWidget({
  id: "project.tree",
  title: "Project",
  area: "left",
  rendererId: "project.tree",
  areaSize: { defaultPx: 240, minPx: 200 },
});
ctx.layout.openWidget("project.tree");
```

Tree nodes can carry `resource` for workbench opening, `actions` for inline buttons, `contextMenuActions` or `menuPath` for context menus, `children`, `description`, and `contextValue`.

## Data renderers

A data renderer is a Notion/Linear-style data workspace registered under `renderers`. It contributes the schema (tag definitions, grouping/ordering/display options, filter categories), the data via `executeQuery(state)` (receives current settings + filters so backends can push filter/sort/pagination down), row-mutation callbacks, and optionally a `savedViews` config block. With `savedViews` set, the workbench's built-in `WorkbenchDataView` shows a save / save-as / rename / duplicate / delete menu wired to `workbench.savedViews`.

Like tree renderers, a data renderer auto-registers a widget renderer with the same id; widgets place the workspace through `layout.registerWidget` and `layout.openWidget`. The data renderer never imports the saved-view registry — saved-view application is the workbench wrapper's job, driven entirely off `placement.resource.metadata.{filter, display}`.

```ts
ctx.renderers.registerDataRenderer({
  id: "tickets",
  title: "Tickets",
  resourceKind: "ticket",
  tagDefinitions: [/* ... */],
  groupingOptions: [/* ... */],
  orderingOptions: [/* ... */],
  displayPropertyOptions: [/* ... */],
  filterCategories: [/* ... */],
  knownColumnKeys: ["backlog", "in-progress", "review", "done"],
  getBoardColumnConfig: (groupKey) => ({ color: "gray", canDragIn: true, canDragOut: true, canCreate: true }),
  executeQuery: ({ settings, filters }) => fetchRows(settings, filters),
  onTicketClick: (row) => {/* ... */},
  onMoveTicket: (rowId, targetColumn, ctx) => {/* ... */},
  onCreateTicket: (columnId) => {/* ... */},
  savedViews: { resourceKind: "ticket", scope: "project", projectId: "demo" },
});

ctx.layout.registerWidget({
  id: "tickets",
  title: "Tickets",
  area: "main",
  rendererId: "tickets",
  resourceKinds: ["savedView"],
  singleton: true,
});
```

When a saved-view resource is opened in this widget, the workbench reads `metadata.{filter, display}` off the resource and applies it to the per-placement workspace store. The save menu turns the current store state back into a saved view via `workbench.savedViews.create` / `.update`.

## Controls renderers

A controls renderer is a reusable inspector/property-panel renderer registered under `renderers`. Like tree and file renderers, it does not place itself — a `view` with `controlsRenderer: "<id>"` mounts it into a panel, and the view owns placement (`resourceKind`, `surface`, `target`). It resolves serializable control declarations + current values through `executeQuery(resource)` and renders them via the `@pstdio/ui` ParamEditor. Live edits commit through `updateValue`; a sticky footer's Apply/Reset use `apply` / `reset`. Omitting both `updateValue` and `apply` (or a query result with `readOnly: true`) makes the panel read-only.

```ts
ctx.renderers.registerControlsRenderer({
  id: "imageInspector",
  title: "Image controls",
  executeQuery: (resource) => loadImageControls(resource), // { params?, groups?, values?, readOnly? }
  updateValue: ({ controlId, value, values, resource }) => saveImageControl(resource, controlId, value),
  reset: ({ resource }) => resetImageControls(resource),
});
```

Extensions declare the renderer with a `controlsRenderers` contribution and place it with a view (`controlsRenderer: "<id>"`, `target: "workbench.main.right"`); see the extension API reference. The dashboard bridges each renderer's command ids to `executeQuery` / `updateValue` / `apply` / `reset` and refreshes the panel after apply/reset commits.

## Modes

Modes activate a bundle of temporary contributions. Switching modes disposes the previous mode's activation result; contributions made through the mode's `activate()` context are tracked alongside the active module.

```ts
workbench.modes.registerMode({
  id: "review",
  label: "Review",
  activate(ctx) {
    return ctx.layout.registerWidget({
      id: "review.summary",
      title: "Review",
      area: "main",
      rendererId: "review.summary",
    });
  },
});

workbench.modes.setActiveMode("review");
```

## Controllers

Controllers expose stateful workbench affordances that are not contribution registries.

```ts
workbench.breadcrumbs.setItems([{ title: "Project" }, { title: "Settings" }]);
workbench.commandPalette.toggle();
workbench.history.goBack();
workbench.panels.setOpen("secondary", false);
workbench.sessionPanel.setMode("attached");
```

| Controller       | API                                                                            |
| ---------------- | ------------------------------------------------------------------------------ |
| `breadcrumbs`    | `setItems(items)` returning a disposable, `clearItems()`, `getItems()`         |
| `commandPalette` | `open()`, `close()`, `toggle()`, `isOpen()`                                    |
| `history`        | `goBack()`, `goForward()`, `goPrevious()`, `recentlyClosed()`, `reopenLastClosed()`, `clear()` |
| `panels`         | `setOpen(areaId, open)`, `toggle(areaId)`, `isOpen(areaId)`                    |
| `sessionPanel`   | `setMode(mode)`, `getMode()` with `attached`, `bubble`, or `closed`            |

Each controller exposes a Zustand-style `store` and an `onDidChange()` event hook for custom subscriptions.

## Runtime Extensions

Runtime extension packages use `@pstdio/sdk/extensions` and `pstdio-extensions` descriptors. The host maps validated extension metadata into extension-owned workbench modules instead of giving extension packages direct workbench access. The bridge renderer in `pstdio-extensions/workbench` provides the renderer registration used by webview-backed widget contributions.

## React Components

`Workbench` renders the complete workbench from a workbench core:

```tsx
<Workbench workbench={workbench} />
```

All workbench state — palette open state, breadcrumbs, session-panel mode, active mode, and renderers — is sourced from the workbench core. Pass the initial session-panel mode through `createWorkbenchCore({ initialSessionPanelMode })` rather than props.

Other React exports are useful when composing a custom workbench surface:

| Component/API                 | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `WorkbenchArea`                   | Render one named workbench area                      |
| `WorkbenchAreaTabs`               | Tabs derived from the placements of an area      |
| `WorkbenchCommandPalette`         | Command palette UI                               |
| `WorkbenchHeaderActions`          | Menu-backed header actions                       |
| `WorkbenchIcon`                   | Icon resolver used by workbench UI                   |
| `WorkbenchKeepAliveLayer`         | Mounts kept-alive renderer subtrees once into stable hosts |
| `useWorkbenchClaim`               | Hook returning the current widget claim inside a kept-alive subtree |
| `WorkbenchNotificationHost`       | Notification renderer                            |
| `WorkbenchTreeView`               | Tree view renderer                               |
| `WorkbenchWidgetHost`             | Widget placement renderer                        |
| `WorkbenchSessionAttachedPanel`   | Attached session panel                           |
| `WorkbenchSessionBubbleContainer` | Floating session bubble                          |
| `listWorkbenchMenuActionItems`    | Resolve menu actions for a path with command info|
| `useWorkbenchStore`               | Subscribe to a workbench store selector              |

## Persistence

`createWorkbenchCore()` accepts persistence adapters for layout, preferences, tree-view state, and side-panel open/closed state.

```ts
const workbench = createWorkbenchCore({
  layoutPersistence: {
    getLayout: (scope) => loadLayout(scope),
    setLayout: (layout, scope) => saveLayout(layout, scope),
  },
  preferencePersistence: {
    getValue: (name, scope) => loadPreference(name, scope),
    setValue: (name, value, scope) => savePreference(name, value, scope),
  },
  treePersistence: {
    getTreeStates: () => loadTreeStates(),
    setTreeStates: (state) => saveTreeStates(state),
  },
  panelsPersistence: {
    getPanelStates: () => loadPanelStates(),
    setPanelStates: (state) => savePanelStates(state),
  },
});
```

Layout persistence stores the full `WorkbenchLayout` and receives the current optional layout scope. Preference persistence stores values by preference name and scope. Tree persistence stores expanded sections, expanded nodes, and selection per tree view. Panel persistence stores the open/closed flag per side-panel area.

## See Also

- [Contribution Ownership](./contribution-ownership.md) — `ownerId`, `source`, contribution metadata, and placement ownership.
- [Navigation](./navigation.md) — URL and resource navigation through workbench parsers, dispatchers, and navigators.
