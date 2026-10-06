# Navigation and layout state

The page location says where the user is. The layout says which panels are open. This page explains both and how navigation changes them.

A page location owns the page reference, optional resource, document section, and contextual parent. Browser URLs, Back/Forward, breadcrumbs, and saved navigation use that location. `ResourceRef` uses `type`, `id`, and optional label and ownership fields. URI conversion belongs to the host's routing and persistence adapters.

A saved location keeps the resource as it was when the page opened, and a URL carries only its identity. A resource kind can name a `resolve` command so the open page follows its data. The host runs that command with `ctx.resource` set to the open resource when another resource opens and after the owning extension emits an event. The command returns the current reference, or `null`. The host takes its label, icon, shorthand, and metadata, and keeps the open resource's identity and route. Menus that match `when.metadata` then read current values. Return page state that arrived in `ctx.resource`, such as a selected document, with the result. Only the kind's own extension can provide the command.

A page declares its routed resource constraint with `resource: { kinds }`. It chooses Main presentation separately. A Main view declares `cardinality`; multiple instances require a routed resource. A Main panel collection declares an `empty` view and shows peer editor panels from its slots. The route keeps workspace context while a file panel becomes active.

Page slots and mode placements share static-view and resource-binding items. Both use Main, Side, and Secondary. Static presence is fixed, open, or closed. A binding has kinds, view, cardinality, and optional add navigation. Generated refs such as `page.panels.inspector` identify page panels.

Workspace Changes and Files use fixed static slots. They receive the page's workspace resource and remain available while switching workspaces. The dashboard's chat bubble opens a New session tab when Side is empty and preserves existing tabs on reopen. Hosts can supply this launcher action through Workbench's `onOpenSidePanel` prop.

A page target changes location and selects its mode. A panel target preserves location and requires an active owner. A compound target prepares its page and panel steps against proposed state, then commits once. A failed preparation changes no history, breadcrumbs, page instances, shared placements, selection, or region visibility. Commands and external links are standalone actions.

An explicit target parent supplies contextual breadcrumbs. Without one, navigation uses the page's declared parent. Closing the last routed resource view follows that declared parent. Closing an auxiliary panel preserves the route. `openOn: "page-resource"` opens a matching binding during page navigation; closing it keeps it closed until another navigation.

The browser owns history. Page location persistence stays at version 1. Layout cache version 5 stores resource identity keys, Main collections, and the Side Panel presentation in the `side` region. Incompatible layout cache entries are discarded, including their Side Panel presentation, while valid locations, resource data, tree state, and menu preferences remain intact. Collection state uses the existing location key to separate workspaces.

Opening or selecting a tab in Side or Secondary keeps the current history entry and preserves Forward navigation. Back and Forward restore tab order, selection, and saved panel visibility. Mode-owned tabs restore their shared order and selection from the project/mode layout cache; page-owned and shell-owned tabs use the location cache. The destination mode becomes active before its layout is restored, so the previous mode cannot change those saved choices.

See the [cookbook](../../guides/extensions/0002-workbench-cookbook.md) for working examples. Host app authors can read the [workbench reference](../workbench/0001-overview.md) for the host controllers.
