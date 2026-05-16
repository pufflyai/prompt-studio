# pstdio-shell API

`pstdio-shell` is the workbench framework used by the dashboard. It exposes a contribution model on a typed core plus React components for rendering that model.

## Imports

```ts
import { createShellCore } from "pstdio-shell/core";
import type {
  ResourceRef,
  ShellArea,
  ShellModuleContribution,
} from "pstdio-shell/core";
import { ShellWorkbench } from "pstdio-shell/react";
```

The package exports:

| Import               | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `pstdio-shell`       | Core API re-export                                   |
| `pstdio-shell/core`  | Registries, controllers, layout model, resources     |
| `pstdio-shell/react` | Workbench, widget host, shell UI components          |

## Core

Create one shell core per workbench instance:

```ts
const shell = createShellCore({
  layoutPersistence,
  preferencePersistence,
  treePersistence,
  panelsPersistence,
  initialSessionPanelMode: "attached",
});
```

`createShellCore()` returns registries and controllers used by shell modules and host-mapped runtime extensions:

| Slot              | Kind       | Use                                                                  |
| ----------------- | ---------- | -------------------------------------------------------------------- |
| `breadcrumbs`     | controller | Current breadcrumb items                                             |
| `commandPalette`  | controller | Open, close, toggle, and observe the command palette                 |
| `commands`        | registry   | Command definitions, handlers, and execution error events            |
| `context`         | service    | Context keys used by menus and keybindings                           |
| `keybindings`     | registry   | Keyboard shortcuts backed by commands                                |
| `layout`          | registry   | Widget contributions, area placeholders, and widget placements       |
| `lifecycle`       | registry   | Hooks for lifecycle phases                                           |
| `menus`           | registry   | Menu actions backed by commands                                      |
| `modes`           | registry   | Mode-specific contribution activation                                |
| `navigation`      | registry   | Location parsing and resource navigation                             |
| `notifications`   | registry   | Toast-style shell notifications                                      |
| `panels`          | controller | Side-panel open/close state per area                                 |
| `preferences`     | registry   | Typed preference schemas and values                                  |
| `renderers`       | registry   | Widget renderers keyed by `rendererId`                               |
| `resources`       | registry   | Resource kinds and resource openers                                  |
| `sessionPanel`    | controller | Session panel mode (`attached`, `bubble`, `closed`)                  |
| `trees`           | registry   | Tree view contributions, sections, and state                         |

## Shell Modules

A shell module receives the same registries and controllers as the shell core. Registrations made through the module context are tagged with module metadata and disposed together.

```ts
const projectModule: ShellModuleContribution = {
  id: "project",
  activate(ctx) {
    ctx.commands.registerCommand(
      { id: "project.refresh", label: "Refresh project" },
      { execute: () => refreshProject() },
    );
  },
};

const disposable = shell.registerModule(projectModule);
```

`activate()` can return extra disposables for subscriptions or custom cleanup. Registry registrations made through the module context are tracked automatically. The same module can later be removed with `shell.unregisterModule(moduleId)`.

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

Available areas are `top`, `activityBar`, `left-header`, `left`, `main-header`, `main-left-header`, `main-left`, `main`, `main-right-header`, `main-right`, `main-bottom-header`, `main-bottom`, `status`, `overlay`, `floating-header`, and `floating`.

Widget options:

| Option               | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `area`               | Primary shell area for the widget                                         |
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

Register an area placeholder when an area needs an empty state after all widget placements close:

```ts
ctx.layout.registerAreaPlaceholder({
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

`replaceActive: true` replaces the active, unpinned placement in the target area. When omitted, the shell adds another placement unless the widget is `singleton`. Pinned and closable flags can also be passed per call.

## Resources

Resources are the navigation and opening contract between trees, links, and widgets.

```ts
ctx.resources.registerKind({
  kind: "project",
  label: "Project",
  icon: "Folder",
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

Call `resources.openResource(resource, { replaceActive: true })` to route through the highest-priority opener whose `canOpen()` returns true.

> Only one opener runs for a resource. If multiple openers match the same resource, the lower-priority openers are unreachable through `openResource()`;
> equal priorities fall back to opener id sorting. Use one generic opener for the default view, and use narrower `canOpen()` predicates or direct
> `layout.openWidget()` calls for alternate views like details panels.

## Renderers

Renderers are registered in their own registry. `ShellWidgetHost` resolves `widget.rendererId` against `shell.renderers` and calls the registered renderer with the widget, placement, shell, and refresh callback.

```tsx
ctx.renderers.registerRenderer({
  id: "project.details",
  render: ({ shell, placement, refresh }) => (
    <ProjectDetails
      shell={shell}
      resource={placement.resource}
      onRefresh={refresh}
    />
  ),
});
```

Renderer input includes `shell`, the registered `widget`, the concrete `placement`, and a `refresh()` callback.

Webview rendering lives in `pstdio-extensions/shell`, which exposes a bridge renderer that hosts can register with `shell.renderers` and reference by `rendererId` on widget contributions.

## Commands, Menus, And Keybindings

Commands are the executable primitive. Menus and keybindings must reference a registered command.

```ts
import {
  headerLeadingMenuPath,
  headerTrailingMenuPath,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-shell/core";

ctx.commands.registerCommand(
  { id: "project.refresh", label: "Refresh", icon: "RefreshCw" },
  {
    execute: () => refreshProject(),
    isEnabled: () => true,
  },
);

ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
  commandId: "project.refresh",
  order: 10,
});

ctx.menus.registerMenuAction(workbenchTopHeaderTrailingMenuPath, {
  commandId: "project.refresh",
  order: 10,
});

ctx.menus.registerMenuAction(headerLeadingMenuPath("main"), {
  commandId: "project.refresh",
  order: 10,
});

ctx.keybindings.registerKeybinding({
  commandId: "project.refresh",
  keybinding: "mod+r",
  when: "project.active",
});
```

`headerLeadingMenuPath(area)` and `headerTrailingMenuPath(area)` return the menu paths the workbench reads when it renders the leading and trailing slots of an area header. Context expressions support truthy keys, negation, equality, inequality, and `&&`, for example `project.active && !dialog.open`.

Subscribe to execution failures with `shell.commands.onDidExecuteError(listener)` to surface errors or instrument analytics.

## Trees

Tree views provide navigation nodes for side panels. A tree view targets one of `left`, `main-left`, `main-right`, or `main-bottom`, and can declare a `role` of `primary` (default) or `footer` so the left side panel can render a primary tree above a footer tree.

```ts
ctx.trees.registerTreeView({
  id: "project.tree",
  title: "Project",
  area: "left",
  role: "primary",
  areaSize: { defaultPx: 240, minPx: 200 },
  getRoots: () => [
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
  getChildren: () => [],
});
```

Tree views can also expose grouped sections with `getSections()`. Tree nodes can carry `resource` for shell opening, `actions` for inline buttons, `contextMenuActions` or `menuPath` for context menus, `children`, `description`, and `contextValue`.

## Modes

Modes activate a bundle of temporary contributions. Switching modes disposes the previous mode's activation result; contributions made through the mode's `activate()` context are tracked alongside the active module.

```ts
shell.modes.registerMode({
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

shell.modes.setActiveMode("review");
```

## Controllers

Controllers expose stateful workbench affordances that are not contribution registries.

```ts
shell.breadcrumbs.setItems([{ title: "Project" }, { title: "Settings" }]);
shell.commandPalette.toggle();
shell.panels.setOpen("main-bottom", false);
shell.sessionPanel.setMode("attached");
```

| Controller       | API                                                                            |
| ---------------- | ------------------------------------------------------------------------------ |
| `breadcrumbs`    | `setItems(items)` returning a disposable, `clearItems()`, `getItems()`         |
| `commandPalette` | `open()`, `close()`, `toggle()`, `isOpen()`                                    |
| `panels`         | `setOpen(areaId, open)`, `toggle(areaId)`, `isOpen(areaId)`                    |
| `sessionPanel`   | `setMode(mode)`, `getMode()` with `attached`, `bubble`, or `closed`            |

Each controller exposes a Zustand-style `store` and an `onDidChange()` event hook for custom subscriptions.

## Runtime Extensions

Runtime extension packages use `@pstdio/sdk/extensions` and `pstdio-extensions` descriptors. The host maps validated extension metadata into extension-owned shell modules instead of giving extension packages direct shell access. The bridge renderer in `pstdio-extensions/shell` provides the renderer registration used by webview-backed widget contributions.

## React Components

`ShellWorkbench` renders the complete workbench from a shell core:

```tsx
<ShellWorkbench shell={shell} />
```

All workbench state — palette open state, breadcrumbs, session-panel mode, active mode, and renderers — is sourced from the shell core. Pass the initial session-panel mode through `createShellCore({ initialSessionPanelMode })` rather than props.

Other React exports are useful when composing a custom workbench surface:

| Component/API                 | Purpose                                          |
| ----------------------------- | ------------------------------------------------ |
| `ShellArea`                   | Render one named shell area                      |
| `ShellAreaTabs`               | Tabs derived from the placements of an area      |
| `ShellCommandPalette`         | Command palette UI                               |
| `ShellHeaderActions`          | Menu-backed header actions                       |
| `ShellIcon`                   | Icon resolver used by shell UI                   |
| `ShellNotificationHost`       | Notification renderer                            |
| `ShellTreeView`               | Tree view renderer                               |
| `ShellWidgetHost`             | Widget placement renderer                        |
| `ShellSessionAttachedPanel`   | Attached session panel                           |
| `ShellSessionBubbleContainer` | Floating session bubble                          |
| `listShellMenuActionItems`    | Resolve menu actions for a path with command info|
| `useShellStore`               | Subscribe to a shell store selector              |

## Persistence

`createShellCore()` accepts persistence adapters for layout, preferences, tree-view state, and side-panel open/closed state.

```ts
const shell = createShellCore({
  layoutPersistence: {
    getLayout: () => loadLayout(),
    setLayout: (layout) => saveLayout(layout),
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

Layout persistence stores the full `ShellLayout`. Preference persistence stores values by preference name and scope. Tree persistence stores expanded sections, expanded nodes, and selection per tree view. Panel persistence stores the open/closed flag per side-panel area.
