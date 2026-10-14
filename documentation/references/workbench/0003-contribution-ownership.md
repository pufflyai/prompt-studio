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

Each tab has one layout owner. Main, page side (`aside`), and page bottom belong to the page instance. Side and Secondary belong to the mode within the project. Dropping a tab across that edge transfers it to the destination owner in the same layout change. Moving between Main, aside, and bottom, or between Side and Secondary, changes only its position.

Page-owned subpanels follow their page's Location binding. A mode-owned tab keeps its own resource without acquiring a page binding when the user visits another page. Primary-resource cleanup only removes unowned host placements; page, mode, and shell owners control their own membership. Explicit contribution eligibility rules still apply.

The tab's `widgetId` stays stable across transfers. Its owner identity changes while its resource, section, preview or pinned retention, draft, and mounted content stay with the tab. The original declaration remains available for opening the tool. Opening that declaration selects a matching transferred tab in the current owner at its actual destination. If the tab belongs to an inactive page, opening the declaration creates a separate tab in its declared owner. Closing a transferred tab allows a later explicit open to create it at the declaration's default destination.

Legacy page slots in Side or Secondary, mode placements in Main, and shell placements still load at their declared defaults. An explicit move applies destination ownership to these tabs too. Panel menus remain with their page or view; they do not become tab destinations.

Resource identity forms the instance key for a resource-bound slot. The same resource in two slots is two independent placements. An update can change a placement's resource, and the placement keeps its instance key. Opening a resource finds the placement that shows it now. A new placement never takes a key that another placement already holds. Region, label, active tab, and registration timing do not define ownership.

## Page surfaces

Only Main contains a page side panel and a page secondary panel (`bottom`). Side, Secondary, and the two page panels can have left and right menus, but cannot contain another pair of page panels. All five panels support menus.

Main contains the page breadcrumb and a page frame. Below the breadcrumb, the page side (`aside`) runs the full height beside the editor and page bottom. The page bottom spans only the editor column. The mode's Side and Secondary surround the whole page. Every page has both page panels, even without slots or region settings. Empty automatic panels start closed; an explicitly opened empty panel keeps its drop surface.

Page `panelMenus` bind directly to the routed page resource. Selecting an auxiliary tab does not retarget them. Collection menus receive no resource. Menus start below the Main header and span the editor content height. The header spans the editor and both menus. They have no header, tabs, add action, or tab destination; they keep their declared size and collapse settings.

Page side and bottom slots use normal page placement identities. Moving a tab among Main, aside, and bottom preserves its view and resource. Both page panels accept tabs unless their `acceptsTabs` policy forbids it. The legacy page slot `side` still places its initial view in the mode Side.

The Page panels menu lives in Main's tab row. It shows or hides collapsible page menus, offers Reset layout, and shows or hides both page panels when their policy permits it. PS-701 moves these controls to the breadcrumb row.

## Saved layouts

The workbench owns persistence scope selection. Hosts supply the storage adapter, not a page-to-scope callback or a list of regions to carry during navigation.

| Saved data | Owner key |
| --- | --- |
| Page sizes and panel edges | Project and page type |
| Page tabs, selection, and retention | Project, page, and routed resource; an unbound or many-resource page has one instance |
| Side and Secondary tabs, selection, sizes, visibility, and Side presentation | Project and mode |

Saved owner records are authoritative. Declarations seed new owners. Returning to a saved page does not recreate a tab that moved out. Mode tabs and their bindings remain available across ordinary page navigation. Page side, page bottom, and mode Secondary save and restore independently.

Mode snapshots store the tabs that still belong to the mode. After a mode tool moves into a page, switching resources restores the remaining mode tabs, including an empty set. It does not replay the mode's default declarations. Returning to the destination page restores the moved tool there. New mode tools can be opened explicitly into an existing saved mode layout.

A Main view with `cardinality: "many"` keeps one collection of resource tabs. Its routed resource selects a tab in that collection; it does not create another layout owner. Leaving the page and returning, or reloading, restores its pinned tabs. A single-resource Main keeps its live view while rebinding to another resource, but each resource owner restores its own optional tabs and selections. Transferring that view changes its owner and preserves its resource binding.

Configured persistence is the source of saved owner state. Clearing an inactive owner removes its saved choices; remembered registry state cannot recreate them. Compound navigation publishes only its final location and saves changes made to inactive owners in that transaction. Section and parent-position changes stay within the same page/resource owner.

Layout cache version 6 discards older local arrangements. Routed locations, resources, tree state, and independent menu preferences stay valid. This ownership and cache reset follows the decision recorded for PS-609; it is a breaking behavior change and must pass the workbench track's release gate before publishing.

Terminal bindings use the stable tab ID. Changing a page scope or transferring a tab cannot create or stop a terminal session. Resource and title updates reach the tab's current or saved owner without changing its identity or view. An explicit close follows the terminal surface's existing lifecycle contract.

## Navigation tree ownership

Mode and page Sidenav contributions carry opaque owner keys. TreeRenderer receives those keys through a configurable movement policy. It does not know mode or page semantics. The policy prevents a customized row from moving across owners while still allowing reorder and hide operations inside one owner.

## Conventions

- Use stable qualified owner ids.
- Use refs instead of parsing contribution ids.
- Never infer ownership from region, resource kind, label, or current tab.
- Never use ownership as a permission decision by itself.
- Return and track every registration disposable.

Panel header visibility uses a context menu on the visible header or hidden top edge, available by right-click, Shift+F10, Context Menu key, and touch long-press. Headers have no ellipsis menu button. Tab context menus offer only Pin/Unpin and Close when applicable; resource actions remain on resource surfaces. Moving a routed editor from Main to page side or page bottom preserves its page/resource, URL, breadcrumb and menu bindings. Main fallback is reconciled when the editor moves out of the page owner into a mode panel.
