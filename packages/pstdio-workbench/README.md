# pstdio-workbench

`pstdio-workbench` is the workbench composition layer for Prompt Studio. It provides a typed core for registering contributions and a React workbench for rendering those contributions. See the [Workbench reference](../../.pstdio/docs/references/workbench/index.md) for the full public API.

## Key concepts

- **Core**: the headless workbench model created by `createWorkbenchCore()`. It owns registries, controllers, and shared state.
- **Workbench**: the React shell rendered by `Workbench`. It reads the core and turns registered contributions into visible UI.
- **Module**: an owner for related contributions. Modules register against the core and their contributions are disposed together. See [Contribution Ownership](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/references/workbench/contribution-ownership.md).
- **Registry**: a typed collection of contributions, such as Panels, tree views, commands, menus, resources, and renderers.
- **Contribution**: a declarative unit registered by a module. Contributions describe what exists; the workbench decides how to render or route them.
- **Controller**: a stateful workbench service, such as breadcrumbs, panels, focus, history, command palette, or the session panel.
- **Region**: a named layout target where Panels can be placed. The workbench owns the chrome around each region.
- **Resource**: a typed reference to something the workbench can open or navigate to.

## Contributions

Contributions are the workbench extension points. A module contributes capabilities into the core; the React workbench renders the current state from those contributions. Contributions are grouped by role: layout, views, resources, navigation, and supporting plumbing. Ownership metadata is documented in [Contribution Ownership](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/references/workbench/contribution-ownership.md).

## Public entry points

- `@pstdio/workbench` exports the headless workbench core, registries, controllers, and contribution types.
- `@pstdio/workbench/react` exports the React shell, view hosts, shared hooks, and `WorkbenchModuleHost` for syncing a dynamic module list into a core.
- `@pstdio/workbench/storage` exports local-storage-backed layout and panel persistence adapters for hosts that want browser persistence with a namespace and scope.
- `@pstdio/workbench/extensions` maps checked extension metadata into workbench contributions.
- `@pstdio/workbench/testing` exports test fixtures and helpers.
- `@pstdio/workbench/webview-runtime` exports the runtime used inside extension webviews.

## Layout contributions

Layout contributions connect regions to views. They declare where a renderer appears, what configuration it receives, and how its placements behave. They do not render UI.

### Panels

Pin a renderer to a region as a panel, editor, dashboard, inspector, status item, or overlay. Panels declare a `region`, `title`, `rendererId`, optional `resourceKinds`, optional sizing and collapsibility, and renderer-owned `config`. They do not contain render code. The shell looks up the `rendererId` in the renderer registry.

- Register with `layout.registerPanel()`
- Set `singleton: true` for one placement total, such as a tree, sidenav, or status view.
- Non-singleton Panels default to `reuse: "resource"`: one placement per resource URI, with no-resource opens reusing the Panel placement.
- Set `reuse: "none"` for scratch, untitled, or transient views where every open should create a new placement.

`closable` and `role` belong to an open placement, not to panel registration. Extension composition derives both from `show` and the active mode recipe. Hosts that open a panel directly can set them in `layout.openPanel(...)`.

### Composition

`workbench.composition.panelsFor(region)` returns the open placements, closed optional panels that can be added, and contribution ids that can be closed for `main`, `secondary`, or `side`. Use it to build panel controls that follow the active mode and resource. `sidenav` participates in extension placement but is not a tab-hosting panel region, so it is not accepted by this query.

See the `pstdio-workbench/API` Storybook section for live composition queries and an extension panel that moves between `main` and `sidenav`.

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) has a minimal Panel pinned to `main`.
- [`foundation`](src/examples/foundation/module.tsx) places one shared renderer in five regions.

### Placeholders

Empty state for regions after every Panel in that region closes. Placeholders render through a `rendererId`, can provide region sizing hints, and do not create tabs, placements, or persisted layout entries.

- Register with `layout.registerPlaceholder()`

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) shows a placeholder in `main` when the welcome Panel is closed.

### Menu items

Surface commands in the command palette, region headers, tree context menus, or custom menu paths. Menu items reference existing commands, can be ordered and grouped, and can be gated by context expressions through command/menu metadata.

- Register with `layout.registerMenuItem(path, item)`

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) adds a trailing menu item to the main header.
- [`foundation`](src/examples/foundation/module.tsx) adds menu items to header paths.

## View contributions

View contributions render placements, tree nodes, and collections as interactive UI.

### Renderers

The React or bridge implementation for a Panel or placeholder. Renderers turn a placement, resource, config, and workbench context into UI. A Panel contributes only a `rendererId`, so the same renderer can back many Panels and a renderer can be supplied by a different layer than its Panel.

- Register with `renderers.registerRenderer()`
- Set `keepAlive: true` on the registration to share one persistent subtree across every Panel that points at the same `rendererId`. The subtree is mounted once into a stable host that is reparented between Panel slots via DOM moves; React state, focus, scroll, and in-flight effects survive region transitions. Kept-alive renderers receive no per-Panel input from `render()`; read the active claim with `useWorkbenchClaim()` from `@pstdio/workbench/react`.

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) uses one renderer per Panel and one placeholder renderer.
- [`foundation`](src/examples/foundation/module.tsx) reuses one renderer across five Panels through `config`.
- [`renderer-types`](src/examples/renderer-types/module.tsx) registers React and bridge renderers together.
- [`keep-alive`](src/examples/keep-alive/module.tsx) shares one keep-alive renderer between attached and floating Side Panel presentations.

### Tree renderers

A tree renderer handles side-panel navigation, outlines, resource lists, and contextual hierarchies. It exposes body sections through `getBody`, optional footer nodes through `getFooter`, and lazy children through `getChildren`. Nodes can carry resources, descriptions, inline actions, context menus, and `contextValue`. A tree renderer registers a Panel renderer with the same id. Use `layout.registerPanel({ rendererId: <tree id> })` and `layout.openPanel(<tree id>)` to place it in a tree-hosting region.

- Register with `renderers.registerTreeRenderer()`

#### Examples

- [`dashboard`](src/examples/dashboard/modules/shell/project-nav.ts) builds the primary tree with resource-backed nodes, footer entries, and context menus.
- [`dynamic-modules`](src/examples/dynamic-modules/modules/explorer-module.tsx) adds and removes a tree module at runtime.

### Kanban renderers

A Notion/Linear-style data workspace registered as a renderer. Kanban renderers contribute the schema (tag definitions, grouping/ordering/display options, filter categories), the rows via `executeQuery(state)` (which receives current settings + filters so backends can push filter/sort/pagination down), and row-mutation callbacks. Like tree renderers, a kanban renderer auto-registers a Panel renderer with the same id, so the workspace is placed via `layout.registerPanel({ rendererId: <kanban renderer id> })` and opened with `layout.openPanel(...)`.

- Register with `renderers.registerKanbanRenderer()`

#### Examples

- [`kanban-renderer`](src/examples/kanban-renderer/module.tsx) shows a schema, mock rows, and renderer-owned controls.
- [`dashboard`](src/examples/dashboard/modules/tickets/collections/ticket-data.ts) integrates the ticket workspace into the dashboard shell.

### Data table renderers

A dense, query-driven table backed by `@pstdio/ui/data-table`. Data table renderers keep row ids and resources outside visible values, support declarative column labels, descriptions, icons, statistics and cell renderers, and use the table's local filtering, sorting, column controls, and pagination. They auto-register a Panel renderer with the same id and can be placed in any workbench region.

- Register with `renderers.registerDataTableRenderer()`
- Refresh with `renderers.refreshDataTableRenderer()` or provide a contribution subscription
- Extensions declare a `dataTable` view body and place that view with `placements`

#### Examples

- [`data-table-renderer`](src/examples/data-table-renderer/module.tsx) builds a service-health table with statistics, color scales, formatted JSON, navigation, and row actions.

### Breadcrumb (TODO: make it a renderer as well)

`<WorkbenchBreadcrumbView workbench={workbench} />` is the React view that turns the breadcrumb controller state into a rendered trail. It subscribes to `workbench.breadcrumbs.store`, builds `BreadcrumbItem`s from the controller items, and returns `null` when the trail is empty. The default `Workbench` renders it in the persistent Nav Chrome; a custom `nav` Panel replaces only that trail area. Panel headers do not own breadcrumbs. Resource navigation drives the trail through `ctx.breadcrumbs.setItems(...)`; each call replaces the trail.

- Render with `<WorkbenchBreadcrumbView workbench={workbench} />` from `@pstdio/workbench/react`
- Drive items with `workbench.breadcrumbs.setItems([...])` from the resource navigation controller
- Set `indicator: "session-status"` when a breadcrumb should show the resource's session completion status

#### Examples

- [`dashboard`](src/examples/dashboard/shared/resource-sync.ts) updates the breadcrumb trail when the open resource changes.
- [`onboarding`](src/examples/onboarding/breadcrumb-module.tsx) keeps a three-level trail in sync with page navigation.

A typical surface combines both layers: a **renderer** supplies the UI, a **Panel** places it in a region with optional `config`, and `layout.openPanel()` creates the placement the user actually sees. Pick the narrowest contribution that matches what you are adding:

- Add a **Panel** to claim a spot in a region for a renderer.
- Add a **renderer** to supply the React or bridge UI for a Panel or placeholder.
- Add a **tree renderer** for navigable hierarchy and resource discovery, and place it with a Panel.
- Add a **placeholder** for region-level empty state, not for normal content.

## Resource contributions

Resource contributions define typed objects the workbench can open, route, or resolve from product data. They keep trees, navigation, and history speaking the same resource language.

### Resource kinds

Declare typed things the workbench can open. Resource refs carry `kind`, `uri`, optional `id`, labels, icons, and metadata. Resource kinds make navigation, presenters, and history speak the same language.

- Register with `resources.registerKind()`
- Use the standard icon names for common resources: project `folder-root`, workspace `computer`, worktree `git-pull-request-draft`, ticket `component`, kanban renderer `square-kanban`, settings `settings`.

#### Examples

- [`renderer-types`](src/examples/renderer-types/module.tsx) defines a module with one resource kind.
- [`navigation`](src/examples/navigation/module.tsx) uses several resource kinds in routing.

### Resource presenters

Map a Resource to the Panel instance that presents it. Presenters declare `canOpen(resource)` and return a Panel from `open(resource, input)`. `openResource()` uses the highest-priority presenter, then establishes the returned Panel as the active Location. Direct `layout.openPanel()` calls display supporting Panels without navigating.

- Register with `resources.registerPresenter()`

#### Examples

- [`renderer-types`](src/examples/renderer-types/module.tsx) routes one resource kind to one of two Panels.
- [`navigation`](src/examples/navigation/module.tsx) uses presenters for parsed navigation targets.

### Resource providers

Look up resources by kind, uri, or search input. Providers let features resolve resources without knowing where they are stored, which keeps trees and navigation decoupled from product data access.

- Register with `resources.registerProvider()`

#### Examples

- [`dashboard`](src/examples/dashboard/modules/tickets/module.ts) provides ticket resources to the ticket board.

## Navigation contributions

Navigation contributions turn incoming locations and resolved workbench targets into concrete workbench actions. They keep URL parsing, command dispatch, view opening, and resource routing centralized.

### Navigation parsers

Turn ingress locations into workbench targets. Parsers convert URLs or location strings into resource, view, command, or compound targets. Compound targets are dispatched transactionally through a checkpoint.

- Register with `navigation.registerParser()`

#### Examples

- [`navigation`](src/examples/navigation/module.tsx) parses URL-like locations into typed targets.

### Navigation navigators

Custom dispatch behavior for navigation targets. Navigators let modules extend how resolved targets are opened while still using the shared navigation service.

- Register with `navigation.registerNavigator()`

## Other contributions

Supporting contributions make view, layout, resource, and navigation contributions useful. They define actions, persistence, scoping, and preferences without directly owning a workbench region.

### Commands

Any executable workbench action. Commands are the primitive behind menus, keybindings, tree actions, notification actions, and command palette entries. Handlers can expose `isEnabled()` and execution failures emit `commands.onDidExecuteError`.

- Register with `commands.registerCommand()`

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) adds a command that opens a Panel.
- [`renderer-types`](src/examples/renderer-types/module.tsx) opens different placements with commands.

### Keybindings

Keyboard access to commands. Keybindings reference command ids and can include a `when` expression such as `project.active && !dialog.open`.

- Register with `keybindings.registerKeybinding()`

#### Examples

- [`foundation`](src/examples/foundation/module.tsx) gates a keybinding with a context key.
- [`random`](src/examples/random/modules/random-workbench.tsx) pairs keybindings with mode-scoped commands.

### Context keys

Conditional command, menu, and keybinding behavior. Module contexts create scoped context keys that are cleaned up with the module. Use context keys for current mode, focused surface, selection state, and other workbench-level conditions.

- Set through the module context with `context.set()`

#### Examples

- [`foundation`](src/examples/foundation/module.tsx) sets `foundation.host` to gate menus and keybindings.
- [`keep-alive`](src/examples/keep-alive/module.tsx) uses a context key to control kept-alive subtree visibility.

### Modes

Temporary bundles of contributions for workspace modes such as project, settings, review, or dashboard. Activating a mode runs its contribution function; switching modes disposes the previous mode's mode-scoped contributions.

- Register with `modes.registerMode()`

#### Examples

- [`workbench-modes`](src/examples/workbench-modes/modules/project-mode.tsx) switches between mode-scoped bundles.
- [`dashboard`](src/examples/dashboard/modules/shell/module.tsx) defines the project mode and its navigation surfaces.

### Preference schemas

Typed settings contributed by a module or runtime extension. Schemas define the shape and default behavior of workbench preferences, while the host can provide scoped persistence.

- Register with `preferences.registerSchema()`

#### Examples

- [`preferences`](src/examples/preferences/module.tsx) registers user and workspace-scoped preference values.

### Notifications

Toast-style messages from modules or extensions. Notifications can include command-backed actions and are rendered by workbench chrome rather than by individual views.

- Show with `notifications.show()`

#### Examples

- [`dynamic-modules`](src/examples/dynamic-modules/modules/diagnostics-module.tsx) emits toasts from a diagnostics module.
- [`navigation`](src/examples/navigation/module.tsx) sends a notification from a navigation flow.

### Themes

The React workbench owns the shared `@pstdio/ui` theme preference system through `WorkbenchThemeProvider`. The available theme set lives on the workbench: `workbench.themes` holds contributed themes, and `useWorkbenchThemePreferences(workbench)` reads the built-in themes plus those. `<Workbench />` feeds that set into its own provider, so a contributed theme appears in the picker only while its contributor stays registered. The workbench also renders the shared `Toaster` viewport for workbench notifications and toast calls from workbench modules. Hosts that render their own chrome (sizing boxes or app-level loading screens) wrap it in `WorkbenchThemeProvider` with the same set so that chrome is themed too. Workbench chrome reads VS Code-compatible color theme tokens such as `editor.background`, `sideBar.background`, `panel.background`, and `editorWidget.background` when extension themes provide them.

#### Examples

- [`extension-themes`](src/examples/extension-themes/module.tsx) registers extensions as workbench modules that add and remove VS Code-compatible color themes at runtime.

### Terminal

Terminals are owned by the host. Extensions do not compose their chrome. The `workbench.terminal` controller owns the session registry. Hosts supply a session opener through `workbench.terminal.setSessionOpener(...)`. Production uses a real PTY transport. Stories and the extension testbench use `createScriptedTerminalBridge` from `@pstdio/ui/terminal`. `createWorkbenchTerminalModule()` registers the terminal Panel in the `secondary` region and the `workbench.terminal.open` command. The Panel renders the shared `Terminal` component from `@pstdio/ui/terminal`. Closing the Panel kills its session. Disposing the controller kills every live session.

Extension webviews never receive PTY handles. A webview with the `terminal.session` capability uses serializable `open`, `write`, `resize`, `kill`, and `subscribe` operations. The host sends output and exit events over the bridge event channel. `createTerminalSessionBridge(host)` from `@pstdio/sdk/extensions` turns that protocol into a bridge accepted by the `Terminal` component.

#### Examples

- [`workbench-modes`](src/examples/workbench-modes/module.tsx) opens the host-owned terminal Panel with a scripted backend.
- [`workbench.stories`](src/examples/workbench.stories.tsx) drives the `HostTerminal` story with `createScriptedTerminalBridge`.

Register related contributions inside one **workbench module** so they share ownership and disposal. For example, a ticket collection module usually contributes a resource kind, resource presenter, Panel, renderer, tree renderer, commands, and menu items together.

## Nomenclature

- **Contribution**: a declarative unit added to a registry, such as a command, menu item, resource kind, Panel, renderer, tree renderer, mode, or KanbanView.
- **Workbench module**: contribution owner registered with `workbench.registerModule(module)` and removed with `workbench.unregisterModule(moduleId)`. Module disposables are tracked and disposed together. See [Contribution Ownership](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/references/workbench/contribution-ownership.md).
- **Runtime extension**: extension metadata from `pstdio-extensions` that a host maps into workbench modules at the trust boundary.
- **Panel placement**: an opened instance of a Panel contribution in a region. Placements track active Panel, resource URI, title, pinned/closable flags, and placement ownership.
- **Tree renderer contribution**: a tree-shaped renderer registered under `renderers`. Provides `getBody` (sectioned body), optional `getFooter` (flat footer node list), and `getChildren` (lazy children). Auto-registers a Panel renderer with the same id so Panels place trees through `layout.registerPanel`.
- **Kanban renderer contribution**: a data-workspace renderer registered under `renderers`. Provides a schema, `executeQuery(state)` rows, and row-mutation callbacks. Auto-registers a Panel renderer with the same id so Panels place the workspace through `layout.registerPanel`. The presentational layer is `<KanbanRenderer>` from `@pstdio/ui`.
- **Data table renderer contribution**: a dense table renderer registered under `renderers`. Provides query rows, optional column descriptors, navigation, and row actions. Extensions place it through a native view; the presentational layer is `<DataTable>` from `@pstdio/ui/data-table`.
- **Placeholder**: an empty-state contribution rendered only when a region has no Panel placements. Placeholders do not appear in tabs.
- **Renderer**: code that turns a Panel placement into UI. The Panel host looks up `rendererId` in `workbench.renderers` and inserts the returned React node.
- **Resource**: a typed object reference with `kind`, `id`, `uri`, and label metadata.
- **Resource presenter**: routing logic that maps a resource to a Panel placement.
- **Command**: an executable action registered in the command registry. Errors raised during execution emit `workbench.commands.onDidExecuteError`.
- **Menu path**: a stable location where commands are surfaced, such as the command palette, a region header, or a tree node context menu.
- **Keybinding**: a keyboard shortcut bound to a command, optionally gated by a context expression.
- **Context key**: boolean or scalar workbench state used by commands, menus, and keybindings to decide when they are active.
- **Preference schema**: typed settings contributed by workbench modules or runtime extensions.
- **Mode**: a named bundle of temporary contributions activated through `workbench.modes`. Switching modes disposes the previous mode's activation result.
- **Tree view section**: a group of nodes inside a tree renderer's `getBody`, with an optional label, optional collapsible flag, and inline actions.
- **Notification**: a transient workbench message emitted by workbench modules or extensions. Notifications can include command-backed actions and are rendered as workbench toast chrome.
- **Side Panel**: the project-owned carry surface controlled by `workbench.sidePanel`. It can be `attached`, `floating`, or `closed` while preserving one live host and its resource binding.

## Regions overview

Workbench regions are named layout targets used by Panel contributions. They describe where a Panel belongs in the workbench; the workbench decides the exact chrome, tabs, resize handles, and visibility behavior.

Use `layout.registerPlaceholder()` for a region empty state that should render only after all Panels in that region close. Placeholders are not Panel placements, so they do not affect tab lists.

Panels with tabs are paired with a `<panel>-header` region that the workbench renders directly above the panel. Panels placed in a header region use a bottom border by default. Set `headerBorderBottom: false` on a Panel contribution to let that Panel own the header separation.

| Region             | Workbench location                           | Typical use                                                   |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------- |
| `nav`              | Nav Chrome across the resource-owned column  | Project selector, breadcrumbs, history, resource actions, region controls |
| `activity`         | Optional rail on the leading edge            | Top-level mode or workspace switching                         |
| `sidenav-header`   | Optional header above `sidenav`              | Sidenav-local controls that must sit above its scrolling content |
| `sidenav`          | Leading Sidenav                              | Navigation trees, registries, outlines, resource lists        |
| `main-header`      | Header above the Main Panel                  | Main Panel tabs and controls                                  |
| `main-left-menu`   | Menu inside the Main Panel's leading edge    | Contextual navigation and document outlines                   |
| `main`             | Central Main Panel                           | Editors, detail pages, dashboards, primary resource views     |
| `main-right-menu`  | Menu inside the Main Panel's trailing edge   | Inspectors, properties, and contextual details                |
| `secondary-header` | Header above the Secondary Panel             | Tabs, add-panel controls, and collapsed-menu controls         |
| `secondary`        | Secondary Panel below the Main Panel         | Diagnostics, activity, logs, terminals, background task output |
| `side-header`      | Header above the Side Panel                  | Session tabs and Side Panel controls                          |
| `side`             | Full-height Side Panel                       | Assistant sessions and independent secondary workflows       |
| `status`           | Full-width Status Bar at the viewport bottom | Compact state, counters, sync status, environment indicators  |
| `overlay`          | Layer above the workbench                    | Modal flows, blocking prompts, transient overlays             |

The command palette, toast notifications, and resize handles are workbench chrome, not workbench regions. Use the `RegionMap` Storybook story to see the current region placement rendered through the real `Workbench`.

## Header actions

Each region header renders command-backed actions from two menu paths derived from `headerLeadingMenuPath(region)` and `headerTrailingMenuPath(region)`. Nav Chrome reuses these paths under `workbenchTopHeaderLeadingMenuPath` and `workbenchTopHeaderTrailingMenuPath`. It keeps history, the breadcrumb trail, the trailing breadcrumb-action slot, and Sidenav/Secondary/Side visibility controls mounted in that order. Workbench modules can register commands and add menu actions to those paths without moving navigation into a Panel Header.

Runtime extensions should only target documented public slots through descriptors; hosts map those descriptors into workbench modules instead of giving extension packages direct workbench access.
