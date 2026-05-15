# pstdio-shell

`pstdio-shell` is the shell composition layer for Prompt Studio. It provides a typed core for registering contributions and a React workbench for rendering those contributions.

## Nomenclature

- **Shell core**: the headless object created by `createShellCore()`. It owns the registries and shared shell state.
- **Registry**: a typed collection of contributions. The shell has registries for commands, menus, keybindings, resources, layout widgets, tree views, webviews, diagnostics, activity, notifications, preferences, lifecycle hooks, and context keys.
- **Contribution**: a declarative unit added to a registry, such as a command, menu item, resource kind, widget, tree view, or diagnostic source.
- **Shell module**: contribution owner registered with `shell.registerModule(module)` and removed with `shell.unregisterModule(moduleId)`.
- **Runtime extension**: extension metadata from `pstdio-extensions` that a host maps into shell modules at the trust boundary.
- **Workbench**: the React frame rendered by `ShellWorkbench`. It arranges the shell areas, command palette, side panels, bottom panel, and session panel.
- **Area**: a named layout target. Current areas are `top`, `activityBar`, `left`, `main-header`, `main`, `main-right`, `main-bottom`, `status`, `floating`, and `overlay`.
- **Widget contribution**: a registered view definition in the layout registry. Widgets declare an area and renderer, for example a React renderer or webview.
- **Widget placement**: an opened instance of a widget contribution in an area. Placements track active widget, resource URI, title, and closability.
- **Renderer**: code that turns a widget placement into UI. React widgets use `createShellRendererRegistry()` and webview widgets use a `WebviewDescriptor`.
- **Resource**: a typed object reference with `kind`, `id`, `uri`, and label metadata.
- **Resource opener**: routing logic that maps a resource to a widget placement.
- **Command**: an executable action registered in the command registry.
- **Menu path**: a stable location where commands are surfaced, such as the command palette or a resource context menu.
- **Keybinding**: a keyboard shortcut bound to a command, optionally gated by a context expression.
- **Context key**: boolean or scalar shell state used by commands, menus, and keybindings to decide when they are active.
- **Preference schema**: typed settings contributed by shell modules or runtime extensions.
- **Tree view**: a navigable hierarchy, usually rendered in a side panel.
- **Diagnostic**: a validation or check result from a registered source.
- **Activity item**: a timeline event emitted by shell modules or extensions.
- **Notification**: a transient shell message emitted by shell modules or extensions. Notifications can include a command-backed primary action and are rendered as workbench toast chrome.
- **Lifecycle hook**: a contribution that runs during a shell phase such as `activate`.
- **Session panel**: the floating or attached assistant surface rendered from the `floating` area.

## Areas Overview

Shell areas are named layout targets used by widget contributions. They describe where a widget belongs in the workbench; the workbench decides the exact chrome, tabs, resize handles, and visibility behavior.

| Area          | Workbench location                                           | Typical use                                                                             |
| ------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `top`         | Top of the content column, right of `activityBar` and `left` | Breadcrumbs, active context, compact global controls, left-panel reopen action          |
| `activityBar` | Narrow rail on the far left                                  | Top-level mode or workspace switching                                                   |
| `left`        | Primary left side panel                                      | Navigation trees, registries, project outlines, resource lists                          |
| `main-header` | Header above `main` and `main-right`                         | Active editor context, compact main controls, main-right and main-bottom reopen actions |
| `main`        | Central content region                                       | Editors, detail pages, dashboards, primary resource views                               |
| `main-right`  | Resizable panel to the right of `main`                       | Inspectors, properties, contextual details                                              |
| `main-bottom` | Resizable panel below `main` and `main-right`                | Diagnostics, activity, logs, terminals, background task output                          |
| `status`      | Bottom status strip                                          | Compact state, counters, sync status, environment indicators                            |
| `floating`    | Session panel surface                                        | Assistant or session UI, either attached or floating                                    |
| `overlay`     | Layer above the workbench                                    | Modal flows, blocking prompts, transient overlays                                       |

The command palette, toast notifications, and resize handles are workbench chrome, not shell areas. Use the `AreaMap` Storybook story to see the current area placement rendered through the real `ShellWorkbench`.

## Header Actions

The workbench header renders command-backed actions from `workbenchTopActionMenuPath`. Shell modules can register commands and add menu actions to that path to expose compact top-right controls while keeping breadcrumbs and the `top` area as shell-owned chrome.

Runtime extensions should only target documented public slots through descriptors; hosts map those descriptors into shell modules instead of giving extension packages direct shell access.

## Consumer Example

See `src/examples` for a Storybook-backed consumer showcase. The examples demonstrate how a host app creates a shell core, registers modules, maps an extension-owned module wrapper, registers React renderers, opens resources, emits notifications, and renders the workbench.
