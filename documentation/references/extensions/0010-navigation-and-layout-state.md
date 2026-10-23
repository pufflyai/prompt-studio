# Navigation and layout state

The page location says where the user is. The layout says which panels are open. This page explains both and how navigation changes them.

A page location owns the page reference, optional resource, document section, typed page params, and contextual parent. Browser URLs, Back/Forward, breadcrumbs, and saved navigation use that location. `ResourceRef` uses `type`, `id`, and optional label and ownership fields. URI conversion belongs to the host's routing and persistence adapters.

A saved location keeps the resource as it was when the page opened, and a URL carries resource identity, declared document selection, and page params. A resource kind can name a `resolve` command so the open page follows its data. The host runs that command with `ctx.resource` set to the open resource when another resource opens and after the owning extension emits an event. The command returns the current reference, or `null`. The host takes its label, icon, shorthand, and metadata, and keeps the open resource's identity and route. Menus that match `when.metadata` then read current values. Return page state that arrived in `ctx.resource`, such as a selected document, with the result. Only the kind's own extension can provide the command.

A page declares its routed resource constraint with `resource: { kinds }`. It chooses Main presentation separately. A Main view declares `cardinality`; multiple instances require a routed resource. A Main panel collection shows peer editor panels from its slots. Either kind may declare an `empty` view instead of the host placeholder. The route keeps workspace context while a file panel becomes active.

Page slots and mode placements share static-view and resource-binding items. Both use Main, Side, and Secondary. Static presence is open or closed; the deprecated fixed value behaves like open in these tab regions. A binding has kinds, view, cardinality, and optional add navigation. Generated refs such as `page.panels.inspector` identify page panels.

Workspace Changes and Files use static slots that can close and reopen. They receive the page's workspace resource and remain available while switching workspaces. The dashboard's chat bubble opens a New session tab when Side is empty and preserves existing tabs on reopen. Hosts can supply this launcher action through Workbench's `onOpenSidePanel` prop.

A page target changes location and selects its mode. A panel target preserves location and requires an active owner. A compound target prepares its page and panel steps against proposed state, then commits once. A failed preparation changes no history, breadcrumbs, page instances, shared placements, selection, or region visibility. Commands and external links are standalone actions.

On a collection page with panels, the rendered breadcrumb also shows the selected panel's
resource. Its label follows that panel's presentation, including updates after renaming.
Every resource crumb resolves its own resource-owned actions. The current view's crumb
also receives that view's custom menu groups; parent crumbs do not inherit them.
The trailing dropdown uses the current placement's resource, or the page resource when
there is no resource placement, and adds current-page actions such as Copy link.
Selecting another tab changes the collection crumb without changing the page URL or
history. Right-click, the Context Menu key, or Shift+F10 opens its actions.

An explicit target parent supplies contextual breadcrumbs. Without one, navigation uses the page's declared parent. Closing the last routed resource view keeps the page and resource active with an empty Main region. The default placeholder offers available tabs as cards; choosing the page's content restores it or moves its existing tab back from another panel. A page may supply custom placeholder content instead. Closing an auxiliary panel preserves the route. `openOn: "page-resource"` opens a matching binding during page navigation; closing it keeps it closed until another navigation.

The browser owns history. Page location persistence stays at version 1. Layout cache version 5 stores resource identity keys, Main collections, and the Side Panel presentation in the `side` region. Incompatible layout cache entries are discarded, including their Side Panel presentation, while valid locations, resource data, tree state, and menu preferences remain intact. Collection state uses the existing location key to separate workspaces.

Opening or selecting a tab in Side or Secondary keeps the current history entry and preserves Forward navigation. Back and Forward within one mode close outgoing unpinned tabs and retain shared pinned tabs in Side and Bottom. **Main tabs belong to the current page**, including shell, mode and host tabs moved into Main. Pinning keeps a Main tab for that page; it does not make it follow navigation. Leaving hides its pinned Main tabs, and returning restores their order, selection and running terminal processes. Moving a tab back to Side or Bottom makes it shared within the mode again. An already shared placement takes precedence over an older Main snapshot of that tab.

The project/mode layout cache owns all Side/Bottom tabs, visibility and sizes, including tabs created by a page. The tab's actual panel determines its lifetime; its creator does not. A separate Main snapshot uses the project, mode, page and resource identity, independently of a host's optional page persistence scope. Switching modes preserves all outgoing tabs, including previews, and restores the destination mode as left. Modes with no panels hide every tray without deleting another mode’s saved layout.

Layout snapshots store placement data. Runtime tab providers, including labels, menus and subscriptions, come from the current registered contribution when a snapshot restores. They are never read as executable providers from JSON.

Resource-page panel choices use the resource and its declared document as their owner. Section, source-position and parent breadcrumb changes keep those same choices. Closing an optional Main view in one section keeps it closed in every section of that document.

An accepted version-5 snapshot may still store Main inside its older page scope. On first load, the cache transfers that entire tray to its captured route's Main owner, preserving foreign-created tabs, order and selection. It then removes Main from the old scope. Visiting a different document or project first does not take ownership of those tabs. An existing Main entry, including an empty one, always wins.

Moving a page tab to Side or Bottom keeps that tab across other pages in the same mode, including after reload. For example, moving Tickets to Side keeps Tickets visible while Project Timeline opens in Main. Moving a Zipline issue from Side to Bottom keeps it in Bottom while visiting the board. Closing, pinning or unpinning such a tab edits its current panel and preserves the current route. Moving it into Main makes it local to the page where it was dropped. Returning to its creator page reuses an existing shared tab in its actual panel. A single-resource Main view has an identity for each resource, so opening resource B cannot replace resource A that was moved into another panel.

Main choices remain independent between pages. Opening the same resource separately on another page and closing that shared view does not delete a hidden pinned Main view on the first page. Moving the first page's actual Main tab into Side or Bottom removes it from that page's Main snapshot.

See the [cookbook](../../guides/extensions/0002-workbench-cookbook.md) for working examples. Host app authors can read the [workbench reference](../workbench/0001-overview.md) for the host controllers.

Params describe view state and stay out of layout cache and breadcrumb identity. A page target carries all destination overrides and pushes history when they change. The page owner can use `page.params.update` to patch params and replace the current history entry. Defaults are omitted from URLs. Invalid URL values use defaults; invalid navigation values fail before any state changes. See [Page params](0005-webview-and-storage-api.md#page-params).
