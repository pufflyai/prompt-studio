# Navigation and layout state

The page location says where the user is. The layout says which panels are open. This page explains both and how navigation changes them.

A page location owns the page reference, optional resource, document section, typed page params, and contextual parent. Browser URLs, Back/Forward, breadcrumbs, and saved navigation use that location. `ResourceRef` uses `type`, `id`, and optional label and ownership fields. URI conversion belongs to the host's routing and persistence adapters.

A saved location keeps the resource as it was when the page opened, and a URL carries resource identity, declared document selection, and page params. A resource kind can name a `resolve` command so the open page follows its data. The host runs that command with `ctx.resource` set to the open resource when another resource opens and after the owning extension emits an event. The command returns the current reference, or `null`. The host takes its label, icon, shorthand, and metadata, and keeps the open resource's identity and route. Menus that match `when.metadata` then read current values. Return page state that arrived in `ctx.resource`, such as a selected document, with the result. Only the kind's own extension can provide the command.

A page declares its routed resource constraint with `resource: { kinds }`. It chooses Main presentation separately. A Main view declares `cardinality`; multiple instances require a routed resource. A Main panel collection declares an `empty` view and shows peer editor panels from its slots. The route keeps workspace context while a file panel becomes active.

Page slots and mode placements share static-view and resource-binding items. Both use Main, Side, and Secondary. Static presence is fixed, open, or closed. A binding has kinds, view, cardinality, and optional add navigation. Generated refs such as `page.panels.inspector` identify page panels.

Workspace Changes and Files use fixed static slots. They receive the page's workspace resource and remain available while switching workspaces. The dashboard's chat bubble opens a New session tab when Side is empty and preserves existing tabs on reopen. Hosts can supply this launcher action through Workbench's `onOpenSidePanel` prop.

A page target changes location and selects its mode. A panel target preserves location and requires an active owner. A compound target prepares its page and panel steps against proposed state, then commits once. A failed preparation changes no history, breadcrumbs, page instances, shared placements, selection, or region visibility. Commands and external links are standalone actions.

On a collection page with panels, the rendered breadcrumb also shows the selected panel's
resource. Its label follows that panel's presentation, including updates after renaming.
Every resource crumb resolves its own resource-owned actions. The current view's crumb
also receives that view's custom menu groups; parent crumbs do not inherit them.
The trailing dropdown uses the current placement's resource, or the page resource when
there is no resource placement, and adds current-page actions such as Copy link.
Selecting another tab changes the collection crumb without changing the page URL or
history. Right-click, the Context Menu key, or Shift+F10 opens its actions.

An explicit target parent supplies contextual breadcrumbs. Without one, navigation uses the page's declared parent. Closing the last routed resource view follows that declared parent. Closing an auxiliary panel preserves the route. `openOn: "page-resource"` opens a matching binding during page navigation; closing it keeps it closed until another navigation.

The browser owns history. Page location persistence stays at version 1. Layout cache version 5 stores resource identity keys, Main collections, and the Side Panel presentation in the `side` region. Incompatible layout cache entries are discarded, including their Side Panel presentation, while valid locations, resource data, tree state, and menu preferences remain intact. Collection state uses the existing location key to separate workspaces.

Opening or selecting a tab in Side or Secondary keeps the current history entry and preserves Forward navigation. Back and Forward within one mode close outgoing unpinned tabs and retain shared pinned tabs in Side and Bottom. **Main tabs belong to the current page**, including shell, mode and host tabs moved into Main. Pinning keeps a Main tab for that page; it does not make it follow navigation. Leaving hides its pinned Main tabs, and returning restores their order, selection and running terminal processes. Moving a tab back to Side or Bottom makes it shared within the mode again. An already shared placement takes precedence over an older Main snapshot of that tab.

The project/mode layout cache owns shared Side/Bottom tabs, visibility and sizes. A separate Main snapshot uses the project, mode, page and resource identity, independently of a host's optional page persistence scope. Host page snapshots keep page-owned auxiliary slots. Switching modes preserves all outgoing tabs, including previews, and restores the destination mode as left. Modes with no panels hide every tray without deleting another mode’s saved layout.

Layout snapshots store placement data. Runtime tab providers, including labels, menus and subscriptions, come from the current registered contribution when a snapshot restores. They are never read as executable providers from JSON.

Moving a page-owned tab changes its saved destination. Returning to that resource page restores the tab in the chosen panel, including after reload. The mode still owns panel visibility and sizes. When page entry reveals its tab, it reveals the tab's actual destination rather than the page's default region. For example, moving a Zipline issue from Side to Bottom keeps it in Bottom when returning from the board.

See the [cookbook](../../guides/extensions/0002-workbench-cookbook.md) for working examples. Host app authors can read the [workbench reference](../workbench/0001-overview.md) for the host controllers.

Params describe view state and stay out of layout cache and breadcrumb identity. A page target carries all destination overrides and pushes history when they change. The page owner can use `page.params.update` to patch params and replace the current history entry. Defaults are omitted from URLs. Invalid URL values use defaults; invalid navigation values fail before any state changes. See [Page params](0005-webview-and-storage-api.md#page-params).
