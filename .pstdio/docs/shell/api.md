# pstdio-shell API

`pstdio-shell` is the workbench framework used by the dashboard. It exposes a core contribution model and React components for rendering that model.

## Imports

```ts
import { createShellCore } from "pstdio-shell/core";
import type {
  ShellModuleContribution,
  ResourceRef,
  ShellArea,
} from "pstdio-shell/core";
import { ShellWorkbench } from "pstdio-shell/react";
```

The package exports:

| Import               | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `pstdio-shell`       | Core API re-export                           |
| `pstdio-shell/core`  | Registries, layout model, resources, widgets |
| `pstdio-shell/react` | Workbench, widget host, shell UI components  |

## Core

Create one shell core per workbench instance:

```ts
const shell = createShellCore({
  layoutPersistence,
  preferencePersistence,
});
```

`createShellCore()` returns the registries used by shell modules and host-mapped runtime extensions:

| Registry         | Use                                                  |
| ---------------- | ---------------------------------------------------- |
| `activity`       | Activity kinds and activity items                    |
| `breadcrumbs`    | Current breadcrumb items                             |
| `commandPalette` | Open, close, toggle, and observe the command palette |
| `commands`       | Command definitions and handlers                     |
| `context`        | Context keys used by menus and keybindings           |
| `diagnostics`    | Diagnostic sources and diagnostic records            |
| `keybindings`    | Keyboard shortcuts backed by commands                |
| `layout`         | Widget contributions and widget placements           |
| `lifecycle`      | Hooks for lifecycle phases                           |
| `menus`          | Menu actions backed by commands                      |
| `modes`          | Mode-specific contribution activation                |
| `navigation`     | Location parsing and resource navigation             |
| `notifications`  | Toast-style shell notifications                      |
| `preferences`    | Typed preference schema and values                   |
| `renderers`      | React/custom widget renderers                        |
| `resources`      | Resource kinds and resource openers                  |
| `trees`          | Tree view contributions                              |
| `webviews`       | Webview descriptors                                  |

## Shell Modules

A shell module receives the same registries as the shell core. Registrations made through the module context are tagged with module metadata and disposed together.

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
  renderer: "react",
  rendererId: "project.details",
});
```

Available areas are `top`, `activityBar`, `left-header`, `left`, `main-header`, `main-left-header`, `main-left`, `main`, `main-right-header`, `main-right`, `main-bottom-header`, `main-bottom`, `status`, `overlay`, `floating-header`, and `floating`.

Widget options:

| Option            | Purpose                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| `area`            | Primary shell area for the widget                                         |
| `fallbackArea`    | Alternate area for callers that do not provide one                        |
| `singleton`       | Reuse one existing placement instead of adding more placements            |
| `areaSize`        | Active widget size hints for resizable areas                              |
| `areaCollapsible` | Whether the active widget allows its area to collapse; defaults to `true` |
| `resourceKinds`   | Resource kinds the widget is intended to display                          |
| `renderer`        | Renderer type or renderer id fallback                                     |
| `rendererId`      | Explicit renderer registration id                                         |
| `webview`         | Webview descriptor when `renderer` is `"webview"`                         |
| `canOpen`         | Optional resource predicate                                               |

`areaSize` supports `defaultPx`, `minPx`, and `maxPx`. The workbench resolves size and collapsibility from the active widget in an area.

Open widgets with append-or-replace behavior:

```ts
ctx.layout.openWidget("project.details", {
  resource,
  title: resource.label,
  replaceActive: true,
});
```

`replaceActive: true` replaces the active, unpinned placement in the target area. When omitted, the shell adds another placement unless the widget is `singleton`.

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

React widgets use renderer registrations. `ShellWidgetHost` resolves `widget.rendererId ?? widget.renderer` and calls the renderer.

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

## Commands, Menus, And Keybindings

Commands are the executable primitive. Menus and keybindings must reference a registered command.

```ts
ctx.commands.registerCommand(
  { id: "project.refresh", label: "Refresh", icon: "RefreshCw" },
  {
    execute: () => refreshProject(),
    isEnabled: () => true,
  },
);

ctx.menus.registerMenuAction(["workbench", "header", "top", "trailing"], {
  commandId: "project.refresh",
  label: "Refresh",
  order: 10,
});

ctx.keybindings.registerKeybinding({
  commandId: "project.refresh",
  keybinding: "mod+r",
  when: "project.active",
});
```

Context expressions support truthy keys, negation, equality, inequality, and `&&`, for example `project.active && !dialog.open`.

## Trees

Tree views provide navigation nodes for side panels.

```ts
ctx.trees.registerTreeView({
  id: "project.tree",
  title: "Project",
  area: "left",
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

Tree nodes can carry `resource` for shell opening, `menuPath` for context actions, `children`, `description`, and `contextValue`.

## Modes

Modes activate a group of temporary contributions. Switching modes disposes the previous mode's activation result.

```ts
shell.modes.registerMode({
  id: "review",
  label: "Review",
  activate(ctx) {
    return ctx.layout.registerWidget({
      id: "review.summary",
      title: "Review",
      area: "main",
      renderer: "react",
      rendererId: "review.summary",
    });
  },
});

shell.modes.setActiveMode("review");
```

## Runtime Extensions

Runtime extension packages still use `@pstdio/sdk/extensions` and `pstdio-extensions` descriptors. The host maps validated extension metadata into extension-owned shell modules instead of giving extension packages direct shell access.

## React Components

`ShellWorkbench` renders the complete workbench:

```tsx
<ShellWorkbench shell={shell} initialSessionPanelMode="attached" />
```

Other React exports are useful when composing a custom workbench surface:

| Component/API                  | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `ShellArea`                    | Render one named shell area        |
| `ShellAreaTabs`                | Chakra tabs for multi-widget areas |
| `ShellCommandPalette`          | Command palette UI                 |
| `ShellHeaderActions`           | Menu-backed header actions         |
| `ShellIcon`                    | Icon resolver used by shell UI     |
| `ShellNotificationHost`        | Notification renderer              |
| `ShellTreeView`                | Tree view renderer                 |
| `ShellWidgetHost`              | Widget placement renderer          |
| `ShellSessionAttachedPanel`    | Attached session panel             |
| `ShellSessionBubbleContainer`  | Floating session bubble            |
| `createShellSessionPanelStore` | Session panel Zustand store        |
| `ShellSessionPanelProvider`    | Provider for session panel state   |
| `useShellSessionPanelStore`    | Hook for session panel state       |

## Persistence

`createShellCore()` accepts persistence adapters for layout and preferences.

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
});
```

Layout persistence stores the full `ShellLayout`. Preference persistence stores values by preference name and scope.
