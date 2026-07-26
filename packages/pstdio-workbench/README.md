# pstdio-workbench

`pstdio-workbench` is the workbench composition layer for Prompt Studio. It provides a typed core for registering contributions and a React workbench for rendering those contributions.

## Key Concepts

- **Core**: the headless workbench model created by `createWorkbenchCore()`. It owns registries, controllers, and shared state.
- **Workbench**: the React shell rendered by `Workbench`. It reads the core and turns registered contributions into visible UI.
- **Module**: an owner for related contributions. Modules register against the core and their contributions are disposed together. See [Contribution Ownership](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/references/workbench/contribution-ownership.md).
- **Registry**: a typed collection of contributions, such as widgets, tree views, commands, menus, resources, and renderers.
- **Contribution**: a declarative unit registered by a module. Contributions describe what exists; the workbench decides how to render or route them.
- **Controller**: a stateful workbench service, such as breadcrumbs, panels, focus, history, command palette, or the session panel.
- **Region**: a named layout target where widgets can be placed. The workbench owns the chrome around each region.
- **Resource**: a typed reference to something the workbench can open or navigate to.

## Contributions

Contributions are the workbench extension points. A module contributes capabilities into the core; the React workbench renders the current state from those contributions. Contributions are grouped by role: layout, views, resources, navigation, and supporting plumbing. Ownership metadata is documented in [Contribution Ownership](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/references/workbench/contribution-ownership.md).

## Public Entry Points

- `pstdio-workbench/core` exports the headless workbench core, registries, controllers, and contribution types.
- `pstdio-workbench/react` exports the React shell, view hosts, shared hooks, and `WorkbenchModuleHost` for syncing a dynamic module list into a core.
- `pstdio-workbench/storage` exports local-storage-backed layout and panel persistence adapters for hosts that want browser persistence with a namespace and scope.

## 🏁 Layout Contributions

Layout contributions are the glue between a region and a view. They declare where a renderer appears in the shell, what config it receives, and how its placements behave — without owning any UI themselves.

### Widgets

Pin a renderer to a region as a panel, editor, dashboard, inspector, status item, or overlay. Widgets declare a `region`, `title`, `rendererId`, optional `resourceKinds`, optional sizing and collapsibility, and renderer-owned `config`. They do not contain render code — the shell looks the `rendererId` up in the renderer registry.

- Register with `layout.registerWidget()`
- Set `singleton: true` for one placement total, such as a tree, sidenav, or status view.
- Non-singleton widgets default to `reuse: "resource"`: one placement per resource URI, with no-resource opens reusing the widget placement.
- Set `reuse: "none"` for scratch, untitled, or transient views where every open should create a new placement.

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) — minimal widget pinned to `main`.
- [`foundation`](src/examples/foundation/module.tsx) — widgets in five different regions all backed by one shared renderer.

### Placeholders

Empty state for regions after every widget in that region closes. Placeholders render through a `rendererId`, can provide region sizing hints, and do not create tabs, placements, or persisted layout entries.

- Register with `layout.registerPlaceholder()`

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) — placeholder shown in `main` when the welcome widget is closed.

### Menu items

Surface commands in the command palette, region headers, tree context menus, or custom menu paths. Menu items reference existing commands, can be ordered and grouped, and can be gated by context expressions through command/menu metadata.

- Register with `layout.registerMenuItem(path, item)`

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) — main-header trailing menu item.
- [`foundation`](src/examples/foundation/module.tsx) — menu items wired into header paths.

---

## 👁️ View Contributions

View contributions are the UI itself — code that turns a placement, a tree node, or a collection into something a user sees and interacts with.

### Renderers

The React or bridge implementation for a widget or placeholder. Renderers turn a placement, resource, config, and workbench context into UI. A widget contributes only a `rendererId`, so the same renderer can back many widgets and a renderer can be supplied by a different layer than its widget.

- Register with `renderers.registerRenderer()`
- Set `keepAlive: true` on the registration to share one persistent subtree across every widget that points at the same `rendererId`. The subtree is mounted once into a stable host that is reparented between widget slots via DOM moves; React state, focus, scroll, and in-flight effects survive region transitions. Kept-alive renderers receive no per-widget input from `render()`; read the active claim with `useWorkbenchClaim()` from `pstdio-workbench/react`.

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) — one renderer per widget, plus a placeholder renderer.
- [`foundation`](src/examples/foundation/module.tsx) — one renderer reused across five widgets in different regions via `config`.
- [`renderer-types`](src/examples/renderer-types/module.tsx) — React and bridge renderers registered side by side.
- [`keep-alive`](src/examples/keep-alive/module.tsx) — keep-alive renderer shared by attached and floating Side Panel presentations.

### Tree Renderers

A tree-shaped renderer for side-panel navigation, outlines, resource lists, and contextual hierarchies. Tree renderers expose body sections (`getBody`), optional footer nodes (`getFooter`), and lazy children (`getChildren`); nodes can carry resources, descriptions, inline actions, context menus, and `contextValue`. Placement is left to widgets — a tree renderer auto-registers a widget renderer with the same id, so `layout.registerWidget({ rendererId: <tree id> })` plus `layout.openWidget(<tree id>)` puts the tree in any tree-hosting region.

- Register with `renderers.registerTreeRenderer()`

#### Examples

- [`dashboard`](src/examples/dashboard/modules/shell/project-nav.ts) — primary tree with resource-backed nodes, footer entries, and context menus.
- [`dynamic-modules`](src/examples/dynamic-modules/modules/explorer-module.tsx) — tree contributed by a module that can be added and removed at runtime.

### Data Renderers

A Notion/Linear-style data workspace registered as a renderer. Data renderers contribute the schema (tag definitions, grouping/ordering/display options, filter categories), the rows via `executeQuery(state)` (which receives current settings + filters so backends can push filter/sort/pagination down), and row-mutation callbacks. Like tree renderers, a data renderer auto-registers a widget renderer with the same id, so the workspace is placed via `layout.registerWidget({ rendererId: <data renderer id> })` and opened with `layout.openWidget(...)`.

- Register with `renderers.registerDataRenderer()`

#### Examples

- [`data-renderer`](src/examples/data-renderer/module.tsx) — focused showcase: schema, mock rows, and renderer-owned controls.
- [`dashboard`](src/examples/dashboard/modules/tickets/collections/ticket-data.ts) — ticket workspace integrated into the dashboard shell.

### Data Table Renderers

A dense, query-driven table backed by `@pstdio/ui/data-table`. Data table renderers keep row ids and resources outside visible values, support declarative column labels, descriptions, icons, statistics and cell renderers, and use the table's local filtering, sorting, column controls, and pagination. They auto-register a widget renderer with the same id and can be placed in any workbench region.

- Register with `renderers.registerDataTableRenderer()`
- Refresh with `renderers.refreshDataTableRenderer()` or provide a contribution subscription
- Extensions contribute `dataTableRenderers` and place them explicitly with `views.<id>.dataTableRenderer`

#### Examples

- [`data-table-renderer`](src/examples/data-table-renderer/module.tsx) — service-health table with statistics, color scales, friendly JSON, navigation, and row actions.

### Breadcrumb (TODO: make it a renderer as well)

`<WorkbenchBreadcrumbView workbench={workbench} />` is the React view that turns the breadcrumb controller state into a rendered trail. It subscribes to `workbench.breadcrumbs.store`, builds `BreadcrumbItem`s from the controller items, and returns `null` when the trail is empty. The default `Workbench` renders it in the persistent Nav Chrome; a custom `nav` widget replaces only that trail area. Panel headers do not own breadcrumbs. Modules drive the trail through `ctx.breadcrumbs.setItems(...)` from resource openers — each call replaces the trail, so the opener fully controls what is shown.

- Render with `<WorkbenchBreadcrumbView workbench={workbench} />` from `pstdio-workbench/react`
- Drive items with `workbench.breadcrumbs.setItems([...])` (typically from a resource opener)
- Set `indicator: "session-status"` when a breadcrumb should show the resource's session completion status

#### Examples

- [`dashboard`](src/examples/dashboard/modules/shell/components/dashboard-main-header.tsx) — custom Main Panel header that places the view alongside workspace controls.
- [`onboarding`](src/examples/onboarding/breadcrumb-module.tsx) — three-level trail set from a page opener.

---

A typical surface combines both layers: a **renderer** supplies the UI, a **widget** places it in a region with optional `config`, and `layout.openWidget()` creates the placement the user actually sees. Pick the narrowest contribution that matches what you are adding:

- Add a **widget** to claim a spot in a region for a renderer.
- Add a **renderer** to supply the React or bridge UI for a widget or placeholder.
- Add a **tree renderer** for navigable hierarchy and resource discovery, and place it with a widget.
- Add a **placeholder** for region-level empty state, not for normal content.

## 🗂️ Resource Contributions

Resource contributions define typed objects the workbench can open, route, or resolve from product data. They keep trees, navigation, and history speaking the same resource language.

### Resource kinds

Declare typed things the workbench can open. Resource refs carry `kind`, `uri`, optional `id`, labels, icons, and metadata. Resource kinds make navigation, openers, and history speak the same language.

- Register with `resources.registerKind()`
- Use the standard icon names for common resources: project `folder-root`, workspace `computer`, worktree `git-pull-request-draft`, ticket `component`, data renderer `square-kanban`, settings `settings`.

#### Examples

- [`renderer-types`](src/examples/renderer-types/module.tsx) — single-kind module.
- [`navigation`](src/examples/navigation/module.tsx) — multiple kinds participating in routing.

### Resource openers

Route a resource to a widget placement. Openers declare `canOpen(resource)` and `open(resource, input)`. `openResource()` uses the highest-priority opener, so keep default openers broad and alternate views narrow.

- Register with `resources.registerOpener()`

#### Examples

- [`renderer-types`](src/examples/renderer-types/module.tsx) — opener routing one resource kind to one of two widgets.
- [`navigation`](src/examples/navigation/module.tsx) — openers used by parsed navigation targets.

### Resource providers

Look up resources by kind, uri, or search input. Providers let features resolve resources without knowing where they are stored, which keeps trees and navigation decoupled from product data access.

- Register with `resources.registerProvider()`

#### Examples

- [`dashboard`](src/examples/dashboard/modules/dashboard.tsx) — provider behind the ticket DataView.

## 🧭 Navigation Contributions

Navigation contributions turn incoming locations and resolved workbench targets into concrete workbench actions. They keep URL parsing, command dispatch, view opening, and resource routing centralized.

### Navigation parsers

Turn ingress locations into workbench targets. Parsers convert URLs or location strings into resource, view, command, or compound targets. Compound targets are dispatched transactionally through a checkpoint.

- Register with `navigation.registerParser()`

#### Examples

- [`navigation`](src/examples/navigation/module.tsx) — parses URL-like locations into typed targets.

### Navigation navigators

Custom dispatch behavior for navigation targets. Navigators let modules extend how resolved targets are opened while still using the shared navigation service.

- Register with `navigation.registerNavigator()`

## Other Contributions

Supporting contributions make view, layout, resource, and navigation contributions useful. They define actions, persistence, scoping, and preferences without directly owning a workbench region.

### Commands

Any executable workbench action. Commands are the primitive behind menus, keybindings, tree actions, notification actions, and command palette entries. Handlers can expose `isEnabled()` and execution failures emit `commands.onDidExecuteError`.

- Register with `commands.registerCommand()`

#### Examples

- [`hello-world`](src/examples/hello-world/module.tsx) — command that opens a widget.
- [`renderer-types`](src/examples/renderer-types/module.tsx) — commands opening different placements.

### Keybindings

Keyboard access to commands. Keybindings reference command ids and can include a `when` expression such as `project.active && !dialog.open`.

- Register with `keybindings.registerKeybinding()`

#### Examples

- [`foundation`](src/examples/foundation/module.tsx) — keybinding gated by a context key.
- [`random`](src/examples/random/modules/random-workbench.tsx) — keybindings paired with mode-scoped commands.

### Context keys

Conditional command, menu, and keybinding behavior. Module contexts create scoped context keys that are cleaned up with the module. Use context keys for current mode, focused surface, selection state, and other workbench-level conditions.

- Set through the module context with `context.set()`

#### Examples

- [`foundation`](src/examples/foundation/module.tsx) — sets `foundation.host` for menu and keybinding gating.
- [`keep-alive`](src/examples/keep-alive/module.tsx) — context key driving kept-alive subtree visibility.

### Modes

Temporary bundles of contributions for workspace modes such as project, settings, review, or dashboard. Activating a mode runs its contribution function; switching modes disposes the previous mode's mode-scoped contributions.

- Register with `modes.registerMode()`

#### Examples

- [`workbench-modes`](src/examples/workbench-modes/modules/project-mode.tsx) — switching between mode-scoped bundles.
- [`dashboard`](src/examples/dashboard/modules/project-mode.tsx) — project and settings modes side by side.

### Preference schemas

Typed settings contributed by a module or runtime extension. Schemas define the shape and default behavior of workbench preferences, while the host can provide scoped persistence.

- Register with `preferences.registerSchema()`

#### Examples

- [`preferences`](src/examples/preferences/module.tsx) — schema registration with user and workspace-scoped preference values.

### Notifications

Toast-style messages from modules or extensions. Notifications can include command-backed actions and are rendered by workbench chrome rather than by individual views.

- Show with `notifications.show()`

#### Examples

- [`dynamic-modules`](src/examples/dynamic-modules/modules/diagnostics-module.tsx) — diagnostics module emitting toasts.
- [`navigation`](src/examples/navigation/module.tsx) — notification surfaced from a navigation flow.

### Themes

The React workbench owns the shared `@pstdio/ui` theme preference system through `WorkbenchThemeProvider`. The available theme set lives on the workbench: `workbench.themes` holds contributed themes, and `useWorkbenchThemePreferences(workbench)` reads the built-in themes plus those. `<Workbench />` feeds that set into its own provider, so a contributed theme appears in the picker only while its contributor stays registered. The workbench also renders the shared `Toaster` viewport for workbench notifications and toast calls from workbench modules. Hosts that render their own chrome (sizing boxes or app-level loading screens) wrap it in `WorkbenchThemeProvider` with the same set so that chrome is themed too. Workbench chrome reads VS Code-compatible color theme tokens such as `editor.background`, `sideBar.background`, `panel.background`, and `editorWidget.background` when extension themes provide them.

#### Examples

- [`extension-themes`](src/examples/extension-themes/module.tsx) — extensions registered as workbench modules, enabled and disabled at runtime, contributing VS Code-compatible color themes that restyle the workbench chrome.

### Terminal

Terminals are a host-owned workbench surface, not extension-composed chrome. `workbench.terminal` (a core controller) owns the session registry; hosts inject how sessions actually open with `workbench.terminal.setSessionOpener(...)` — a real PTY transport in production, `createScriptedTerminalBridge` from `@pstdio/ui/terminal` in stories and the extension testbench. `createWorkbenchTerminalModule()` registers the terminal panel in the `secondary` region plus the `workbench.terminal.open` command; the panel renders the shared `Terminal` component from `@pstdio/ui/terminal`. Closing the panel kills its session; disposing the controller kills every live session.

Extension webviews never receive PTY handles. A webview that declares the `terminal.session` capability talks to the same session registry through serializable operations (`open`/`write`/`resize`/`kill`/`subscribe`), with output and exit events pushed over the bridge's host-event channel — `createTerminalSessionBridge(host)` from `@pstdio/sdk/extensions` wraps that protocol into a bridge the `Terminal` component accepts.

#### Examples

- [`workbench-modes`](src/examples/workbench-modes/module.tsx) — workspace mode opening the host-owned terminal panel against a scripted backend.
- [`workbench.stories`](src/examples/workbench.stories.tsx) — `HostTerminal` story with the panel driven by `createScriptedTerminalBridge`.

---

Register related contributions inside one **workbench module** so they share ownership and disposal. For example, a ticket collection module usually contributes a resource kind, resource opener, widget, renderer, tree renderer, commands, and menu items together.

## Core

The core is UI-independent. It is the source of truth that modules write to and the React workbench reads from.
A host normally creates one core, registers modules into it, and renders `<Workbench workbench={workbench} />`.

## Nomenclature

- **Workbench core**: the headless object created by `createWorkbenchCore()`. It owns the registries, controllers, and shared workbench state.
- **Registry**: a typed collection of contributions. The workbench has registries for commands, keybindings, resources, layout (widgets, placeholders, menu items), renderers (widget renderers and tree renderers), modes, navigation, notifications, and preferences.
- **Controller**: a stateful slice of workbench UX exposed alongside the registries — breadcrumbs, command palette open/close state, focus, history, side-panel open/close state, and session-panel mode.
- **Contribution**: a declarative unit added to a registry, such as a command, menu item, resource kind, widget, renderer, tree renderer, mode, or DataView.
- **Workbench module**: contribution owner registered with `workbench.registerModule(module)` and removed with `workbench.unregisterModule(moduleId)`. Module disposables are tracked and disposed together. See [Contribution Ownership](https://github.com/pufflyai/prompt-studio/blob/main/.pstdio/docs/references/workbench/contribution-ownership.md).
- **Runtime extension**: extension metadata from `pstdio-extensions` that a host maps into workbench modules at the trust boundary.
- **Workbench**: the React frame rendered by `Workbench`. It arranges the workbench regions, command palette, panels, and session surface from the workbench core only.
- **Region**: a named layout target. See the Regions Overview table below.
- **Widget contribution**: a registered view definition in the layout registry. Widgets declare a region, a `rendererId`, and optional renderer-owned `config`.
- **Widget placement**: an opened instance of a widget contribution in a region. Placements track active widget, resource URI, title, pinned/closable flags, and placement ownership.
- **Tree renderer contribution**: a tree-shaped renderer registered under `renderers`. Provides `getBody` (sectioned body), optional `getFooter` (flat footer node list), and `getChildren` (lazy children). Auto-registers a widget renderer with the same id so widgets place trees through `layout.registerWidget`.
- **Data renderer contribution**: a data-workspace renderer registered under `renderers`. Provides a schema, `executeQuery(state)` rows, and row-mutation callbacks. Auto-registers a widget renderer with the same id so widgets place the workspace through `layout.registerWidget`. The presentational layer is `<DataRenderer>` from `@pstdio/ui`.
- **Data table renderer contribution**: a dense table renderer registered under `renderers`. Provides query rows, optional column descriptors, navigation, and row actions. Extensions place it through a native view; the presentational layer is `<DataTable>` from `@pstdio/ui/data-table`.
- **Placeholder**: an empty-state contribution rendered only when a region has no widget placements. Placeholders do not appear in tabs.
- **Renderer**: code that turns a widget placement into UI. The widget host looks up `rendererId` in `workbench.renderers` and inserts the returned React node.
- **Resource**: a typed object reference with `kind`, `id`, `uri`, and label metadata.
- **Resource opener**: routing logic that maps a resource to a widget placement.
- **Command**: an executable action registered in the command registry. Errors raised during execution emit `workbench.commands.onDidExecuteError`.
- **Menu path**: a stable location where commands are surfaced, such as the command palette, a region header, or a tree node context menu.
- **Keybinding**: a keyboard shortcut bound to a command, optionally gated by a context expression.
- **Context key**: boolean or scalar workbench state used by commands, menus, and keybindings to decide when they are active.
- **Preference schema**: typed settings contributed by workbench modules or runtime extensions.
- **Mode**: a named bundle of temporary contributions activated through `workbench.modes`. Switching modes disposes the previous mode's activation result.
- **Tree view section**: a group of nodes inside a tree renderer's `getBody`, with an optional label, optional collapsible flag, and inline actions.
- **Notification**: a transient workbench message emitted by workbench modules or extensions. Notifications can include command-backed actions and are rendered as workbench toast chrome.
- **Side Panel**: the project-owned carry surface controlled by `workbench.sidePanel`. It can be `attached`, `floating`, or `closed` while preserving one live host and its resource binding.

## Regions Overview

Workbench regions are named layout targets used by widget contributions. They describe where a widget belongs in the workbench; the workbench decides the exact chrome, tabs, resize handles, and visibility behavior.

Use `layout.registerPlaceholder()` for a region empty state that should render only after all widgets in that region close. Placeholders are not widget placements, so they do not affect tab lists.

Panels with tabs are paired with a `<panel>-header` region that the workbench renders directly above the panel. Widgets placed in a header region use a bottom border by default. Set `headerBorderBottom: false` on a widget contribution to let that widget own the header separation.

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

## Header Actions

Each region header renders command-backed actions from two menu paths derived from `headerLeadingMenuPath(region)` and `headerTrailingMenuPath(region)`. Nav Chrome reuses these paths under `workbenchTopHeaderLeadingMenuPath` and `workbenchTopHeaderTrailingMenuPath`. It keeps history, the breadcrumb trail, the trailing breadcrumb-action slot, and Sidenav/Secondary/Side visibility controls mounted in that order. Workbench modules can register commands and add menu actions to those paths without moving navigation into a Panel Header.

Runtime extensions should only target documented public slots through descriptors; hosts map those descriptors into workbench modules instead of giving extension packages direct workbench access.
