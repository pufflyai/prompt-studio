# Navigation and layout state

The page location says where the user is. The layout says which panels are open. This page explains both and how navigation changes them.

A page location owns the page reference, optional mode, resource, document section, and contextual parent. Browser URLs, Back/Forward, breadcrumbs, and saved navigation use that location. `ResourceRef` uses `type`, `id`, and optional label and ownership fields. URI conversion belongs to the host's routing and persistence adapters.

A saved location keeps the resource as it was when the page opened, and a URL carries only its identity. A resource kind can name a `resolve` command so the open page follows its data. The host runs that command with `ctx.resource` set to the open resource when another resource opens and after the owning extension emits an event. The command returns the current reference, or `null`. The host takes its label, icon, shorthand, metadata, and resource context, and keeps the open resource's identity and route. Menus that match `when.metadata` then read current values. Return page state that arrived in `ctx.resource`, such as a selected document, with the result. Only the kind's own extension can provide the command.

A page declares its routed resource constraint with `resource: { kinds }`. It chooses Main presentation separately. A Main view declares `cardinality`; multiple instances require a routed resource. A Main panel collection declares an `empty` view and shows peer editor panels from its slots. The route keeps workspace context while a file panel becomes active.

Page slots and mode placements share static-view and resource-binding items. Both retain Main, Side, and Secondary. Page slots also accept aside and bottom, inside Main; every page has both page panels. Only Main contains a page side and page secondary panel. Other panels support menus without nested page panels. Static presence is fixed, open, or closed. A binding has kinds, view, cardinality, and optional add navigation. Generated refs such as `page.panels.inspector` identify page panels.

Page menus always read the routed page resource, even when a different resource tab has focus. Page navigation rebinds the menus, aside slots, and bottom slots together. Each page panel keeps its own tabs and selection; it never uses the mode panels' tab lists. Main's breadcrumb sits above the page frame. Menus sit beside the editor tab row.

Workspace Changes and Files use fixed static slots. They receive the page's workspace resource and remain available while switching workspaces. The dashboard's chat bubble opens a New session tab when Side is empty and preserves existing tabs on reopen. Hosts can supply this launcher action through Workbench's `onOpenSidePanel` prop.

A page target changes location and selects an allowed mode. Its optional `mode` requests a mode explicitly; see [page availability](0009-modes-and-layout.md#page-availability). A panel target preserves location and requires an active owner. A compound target prepares its page and panel steps against proposed state, then commits once. A failed preparation changes no history, breadcrumbs, page instances, shared placements, selection, or region visibility. Commands and external links are standalone actions.

Main's owning page drives the breadcrumb, navigation selection, and + catalog, even when a resource in another panel has focus. Focused-editor commands continue to use the focused resource. On a collection page with panels, the rendered breadcrumb also shows Main's selected panel resource. Its label and context actions use the same tab snapshot as that panel, including
updates after renaming. Selecting another Main tab changes this crumb without changing the
page URL or history. Right-click, the Context Menu key, or Shift+F10 opens its actions.

An explicit target parent supplies contextual breadcrumbs. Without one, navigation uses the page's declared parent. Closing the last routed resource view follows that declared parent. Closing an auxiliary panel preserves the route. `openOn: "page-resource"` opens a matching binding during page navigation; closing it keeps it closed until another navigation.

The browser owns history. New page locations capture their mode, including contextual parents. Back and Forward validate the stored page/mode pair before changing state. URLs carry `mode=<registered-mode-id>`, such as `mode=project` or `mode=acme.music.mode.compose`; the SDK URL helpers accept a `ModeRef`. URLs without a mode retain legacy routing behavior. A copied unavailable mode/page link fails through the normal navigation diagnostic. Page location persistence stays at version 1 and also remembers the last page per mode in each project. Layout cache version 6 saves page tabs per page instance, page sizes and panel edges per page type, and Side and Secondary state per mode. Older local arrangements are discarded, while valid locations, resource data, tree state, and menu preferences remain intact. A tab explicitly moved across the page edge adopts its destination owner and keeps its stable tab identity and resource. This breaking behavior requires the workbench track's release gate before publishing.

Opening or selecting a tab in Side or Secondary keeps the current history entry and preserves Forward navigation. Back and Forward restore page tabs while preserving the mode's current Side and Secondary choices. Mode-owned tabs restore their shared order and selection from the project/mode layout cache; page-owned and legacy shell-owned tabs use the page-instance cache. The destination mode becomes active before its layout is restored, so the previous mode cannot change those saved choices.

A resource owner can provide `ResourceRef.context`: `{ type: "workspace", id, projectId?, label? }` or `{ type: "project", id, label? }`. Placement does not change this relationship. A resource shown inside another workspace has a muted link indicator whose hover, focus, and accessible explanation names the real context. Same-workspace resources have no indicator. A workspace context without a readable label has no invented explanation. Global panels have no containing workspace to compare against.

For live relationships, the tab query can return the same canonical `context` in `PlacementTabSnapshot` and declare `refreshEvents`. The host refreshes this projection without moving or rebinding the tab. No foreign-tab flag is saved. Resource context stays out of resource identity URIs.

See the [cookbook](../../guides/extensions/0002-workbench-cookbook.md) for working examples. Host app authors can read the [workbench reference](../workbench/0001-overview.md) for the host controllers.

## Page side and bottom panels

Every page has a page side (`aside`) and a page bottom (`bottom`), initially closed when empty. Slots are optional. Use `slots[].region: "aside"` to seed the page side and `regionSettings.aside` to set its panel policy. Aside and bottom share size, header visibility, `canOpen`, `canClose`, `acceptsTabs`, `resizable`, `movable`, and `defaultTab` settings. A default tab opens only on a direct open of an empty panel. Floating is supported only by the mode Side.

Tabs moved into either page panel stay with the page instance. Panel sizes and edges are saved per page type. The page side runs the full height below the breadcrumb beside the editor and page bottom. The page bottom spans the editor column. Page menus sit beside the editor tab row at full editor height and accept no tabs. Legacy slots in `"side"` still refer to the mode Side; `"aside"` adds the page side without changing that meaning.

Host workbench pages can author `regionSettings.aside.edge` as `"left"` or `"right"` and `regionSettings.bottom.edge` as `"top"` or `"bottom"`. These host geometry fields are separate from the public extension policy fields. Defaults are right and bottom. Whole-panel move commands and gestures follow in PS-613.
