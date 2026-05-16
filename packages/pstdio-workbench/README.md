# pstdio-workbench

`pstdio-workbench` is the workbench composition layer for Prompt Studio. It provides a typed core for registering contributions and a React workbench for rendering those contributions.

## Nomenclature

- **Workbench core**: the headless object created by `createWorkbenchCore()`. It owns the registries, controllers, and shared workbench state.
- **Registry**: a typed collection of contributions. The workbench has registries for commands, menus, keybindings, resources, layout widgets, renderers, modes, tree views, navigation, notifications, preferences, and lifecycle hooks.
- **Controller**: a stateful slice of workbench UX exposed alongside the registries — breadcrumbs, command palette open/close state, side-panel open/close state, and session-panel mode.
- **Contribution**: a declarative unit added to a registry, such as a command, menu item, resource kind, widget, renderer, mode, or tree view.
- **Workbench module**: contribution owner registered with `workbench.registerModule(module)` and removed with `workbench.unregisterModule(moduleId)`. Module disposables are tracked and disposed together.
- **Runtime extension**: extension metadata from `pstdio-extensions` that a host maps into workbench modules at the trust boundary.
- **Workbench**: the React frame rendered by `Workbench`. It arranges the workbench areas, command palette, side panels, and session panel from the workbench core only.
- **Area**: a named layout target. See the Areas Overview table below.
- **Widget contribution**: a registered view definition in the layout registry. Widgets declare an area, a `rendererId`, and optional renderer-owned `config`.
- **Widget placement**: an opened instance of a widget contribution in an area. Placements track active widget, resource URI, title, pinned/closable flags.
- **Area placeholder**: an empty-state contribution rendered only when an area has no widget placements. Placeholders do not appear in tabs.
- **Renderer**: code that turns a widget placement into UI. The widget host looks up `rendererId` in `workbench.renderers` and inserts the returned React node.
- **Resource**: a typed object reference with `kind`, `id`, `uri`, and label metadata.
- **Resource opener**: routing logic that maps a resource to a widget placement.
- **Command**: an executable action registered in the command registry. Errors raised during execution emit `workbench.commands.onDidExecuteError`.
- **Menu path**: a stable location where commands are surfaced, such as the command palette, an area header, or a tree node context menu.
- **Keybinding**: a keyboard shortcut bound to a command, optionally gated by a context expression.
- **Context key**: boolean or scalar workbench state used by commands, menus, and keybindings to decide when they are active.
- **Preference schema**: typed settings contributed by workbench modules or runtime extensions.
- **Mode**: a named bundle of temporary contributions activated through `workbench.modes`. Switching modes disposes the previous mode's activation result.
- **Tree view**: a navigable hierarchy with sections, actions, and a `role` (`primary` or `footer`) used by the workbench to decide where to render it.
- **Notification**: a transient workbench message emitted by workbench modules or extensions. Notifications can include command-backed actions and are rendered as workbench toast chrome.
- **Lifecycle hook**: a contribution that runs during a workbench phase such as `activate`.
- **Session panel**: the assistant surface controlled by `workbench.sessionPanel`. It can be `attached`, `bubble`, or `closed`, and is rendered from the `floating` area.

## Areas Overview

Workbench areas are named layout targets used by widget contributions. They describe where a widget belongs in the workbench; the workbench decides the exact chrome, tabs, resize handles, and visibility behavior.

Use `layout.registerAreaPlaceholder()` for an area empty state that should render only after all widgets in that area close. Area placeholders are not widget placements, so they do not affect tab lists.

Most panels are paired with a `<panel>-header` area that the workbench renders directly above the panel. Widgets placed in a header area use a bottom border by default. Set `headerBorderBottom: false` on a widget contribution to let that widget own the header separation.

| Area                 | Workbench location                                      | Typical use                                                                    |
| -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `top`                | Top of the workbench, right of `activityBar` and `left` | Breadcrumbs, active context, compact global controls, left-panel reopen action |
| `activityBar`        | Narrow rail on the far left                             | Top-level mode or workspace switching                                          |
| `left-header`        | Header above `left`                                     | Project brand, primary navigation header actions                               |
| `left`               | Primary left side panel                                 | Navigation trees, registries, project outlines, resource lists                 |
| `main-header`        | Header above `main`, `main-left`, `main-right`          | Active editor context, compact main controls, panel reopen actions             |
| `main-left-header`   | Header above `main-left`                                | Secondary navigation header                                                    |
| `main-left`          | Resizable panel to the left of `main`                   | Per-mode navigation trees (settings, document outlines)                        |
| `main`               | Central content region                                  | Editors, detail pages, dashboards, primary resource views                      |
| `main-right-header`  | Header above `main-right`                               | Inspector controls, contextual filters                                         |
| `main-right`         | Resizable panel to the right of `main`                  | Inspectors, properties, contextual details                                     |
| `main-bottom-header` | Header above `main-bottom`                              | Tab strips, log filters                                                        |
| `main-bottom`        | Resizable panel below `main`, `main-left`, `main-right` | Diagnostics, activity, logs, terminals, background task output                 |
| `status`             | Bottom status strip                                     | Compact state, counters, sync status, environment indicators                   |
| `overlay`            | Layer above the workbench                               | Modal flows, blocking prompts, transient overlays                              |
| `floating-header`    | Header of the session panel                             | Session-panel title, mode toggle                                               |
| `floating`           | Session panel surface                                   | Assistant or session UI, either attached or floating                           |

The command palette, toast notifications, and resize handles are workbench chrome, not workbench areas. Use the `AreaMap` Storybook story to see the current area placement rendered through the real `Workbench`.

## Header Actions

Each area header renders command-backed actions from two menu paths derived from `headerLeadingMenuPath(area)` and `headerTrailingMenuPath(area)`. The top header reuses these paths under `workbenchTopHeaderLeadingMenuPath` and `workbenchTopHeaderTrailingMenuPath`. Workbench modules can register commands and add menu actions to those paths to expose compact header controls while keeping breadcrumbs and the `top` area as workbench-owned chrome.

Runtime extensions should only target documented public slots through descriptors; hosts map those descriptors into workbench modules instead of giving extension packages direct workbench access.

## Consumer Example

See `src/examples` for Storybook-backed consumer showcases. Each example demonstrates a slice of the workbench:

- `hello-world` — minimal workbench wiring with a single widget.
- `consumer` — a host that creates a workbench core, registers modules, maps an extension-owned module wrapper, registers renderers, opens resources, and emits notifications.
- `workbench-modes` — switching between mode-scoped contribution bundles.
- `area-map` — every workbench area rendered side by side for layout reference.
- `dynamic-modules` — adding and removing workbench modules at runtime.
- `renderer-types` — React and bridge renderer registrations resolved through `workbench.renderers`.
- `dashboard` — multi-resource workbench with tree views, settings, and tabbed main editors.
- `random` — multi-mode demo with per-mode trees, widgets, and resource openers.
