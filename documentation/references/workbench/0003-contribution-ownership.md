# Contribution ownership

Ownership records which workbench module, extension, mode, or page supplied a contribution.

Ownership is separate from contribution IDs, project IDs, resource IDs, and user identity.

## Registration ownership

Register contributions through a module activation context. The context stamps the module's `ownerId` and `source` on registrations and tracks their disposables. Unregistering the module disposes that complete registration set.

Runtime extension registrations use the qualified extension id and `source: "extension"`. This makes commands, views, pages, placements, menus, notifications, and webviews attributable to the package that supplied them.

Ownership metadata explains and orders a contribution. Tracked disposables perform cleanup; an owner id is not a cleanup mechanism by itself.

## Placement ownership

Visible placement identity is more specific than registration ownership:

```ts
type PlacementIdentity =
  | { kind: "mode"; modeId: string; placementId: string; instanceKey: string }
  | { kind: "page"; pageId: string; slotId: string; instanceKey: string }
  | { kind: "shell"; placementId: string; instanceKey: string };
```

Each tab has one layout owner. Main and page bottom belong to the page instance. Side and Secondary belong to the mode within the project. Dropping a tab across that edge transfers it to the destination owner in the same layout change. Moving between Main and bottom, or between Side and Secondary, changes only its position.

The tab's `widgetId` stays stable across transfers. Its owner identity changes while its resource, section, preview or pinned retention, draft, and mounted content stay with the tab. The original declaration remains available for opening the tool. Opening that declaration selects an existing transferred tab at its actual destination. Closing a transferred tab allows a later explicit open to create it at the declaration's default destination.

Legacy page slots in Side or Secondary, mode placements in Main, and shell placements still load at their declared defaults. An explicit move applies destination ownership to these tabs too. Panel menus remain with their page or view; they do not become tab destinations.

Resource identity forms the instance key for a resource-bound slot. The same resource in two slots is two independent placements. An update can change a placement's resource, and the placement keeps its instance key. Opening a resource finds the placement that shows it now. A new placement never takes a key that another placement already holds. Region, label, active tab, and registration timing do not define ownership.

## Page surfaces

Main contains the page's breadcrumb row, tab and action row, optional left and right menus, and a separate bottom tab region. The mode's Secondary remains outside Main.

Page `panelMenus` bind directly to the routed page resource. Selecting an auxiliary tab does not retarget them. Collection menus receive no resource. Menus have no header, tabs, add action, or tab destination; they keep their declared size and collapse settings.

Page bottom slots use normal page placement identities. Moving a tab between Main and bottom preserves its view and resource. Bottom is a destination only while the current page declares it through a slot or `regionSettings.bottom`.

The Page panels menu lives in Main's tab row. It shows or hides collapsible page menus and opens tools in the page bottom. It has no page-bottom visibility item.

## Saved layouts

The workbench owns persistence scope selection. Hosts supply the storage adapter, not a page-to-scope callback or a list of regions to carry during navigation.

| Saved data | Owner key |
| --- | --- |
| Page sizes | Project and page type |
| Page tabs, selection, and retention | Project, page, and routed resource; an unbound page has one instance |
| Side and Secondary tabs, selection, sizes, visibility, and Side presentation | Project and mode |

Saved owner records are authoritative. Declarations seed new owners. Returning to a saved page does not recreate a tab that moved out. Mode tabs and their bindings remain available across ordinary page navigation. Page bottom and mode Secondary save and restore independently.

Layout cache version 6 discards older local arrangements. Routed locations, resources, tree state, and independent menu preferences stay valid. This ownership and cache reset follows the decision recorded for PS-609; it is a breaking behavior change and must pass the workbench track's release gate before publishing.

Terminal bindings use the stable tab ID. Changing a page scope or transferring a tab cannot create or stop a terminal session. An explicit close follows the terminal surface's existing lifecycle contract.

## Navigation tree ownership

Mode and page Sidenav contributions carry opaque owner keys. TreeRenderer receives those keys through a configurable movement policy. It does not know mode or page semantics. The policy prevents a customized row from moving across owners while still allowing reorder and hide operations inside one owner.

## Conventions

- Use stable qualified owner ids.
- Use refs instead of parsing contribution ids.
- Never infer ownership from region, resource kind, label, or current tab.
- Never use ownership as a permission decision by itself.
- Return and track every registration disposable.
