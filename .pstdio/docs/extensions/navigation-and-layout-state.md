# Navigation and layout state

A page location owns the page reference, optional resource, document section, and contextual parent. Browser URLs, Back/Forward, breadcrumbs, and saved navigation use that location. `ResourceRef` uses `type`, `id`, and optional label and ownership fields. URI conversion belongs to the host's routing and persistence adapters.

A page declares its routed resource constraint with `resource: { kinds }`. It chooses Main presentation separately. A Main view declares `cardinality`; multiple instances require a routed resource. A Main panel collection declares an `empty` view and shows peer editor panels from its slots. The route keeps workspace context while a file panel becomes active.

Page slots and mode placements share static-view and resource-binding items. Both use Main, Side, and Secondary. Static presence is fixed, open, or closed. A binding has kinds, view, cardinality, and optional add navigation. Generated refs such as `page.panels.inspector` identify page panels.

A page target changes location and selects its mode. A panel target preserves location and requires an active owner. A compound target prepares its page and panel steps against proposed state, then commits once. A failed preparation changes no history, breadcrumbs, page instances, shared placements, selection, or region visibility. Commands and external links are standalone actions.

An explicit target parent supplies contextual breadcrumbs. Without one, navigation uses the page's declared parent. Closing the last routed resource view follows that declared parent. Closing an auxiliary panel preserves the route. `openOn: "page-resource"` opens a matching binding during page navigation; closing it keeps it closed until another navigation.

The browser owns history. Page location persistence stays at version 1. Layout cache version 4 stores resource identity keys and Main collections. Incompatible layout cache entries are discarded, while valid locations, resource data, tree state, menu preferences, and side-panel presentation remain intact. Collection state uses the existing location key to separate workspaces.

See the [cookbook](cookbook.md) for executable authoring sources and the [workbench guide](../../../packages/pstdio-workbench/README.md) for host controllers.
