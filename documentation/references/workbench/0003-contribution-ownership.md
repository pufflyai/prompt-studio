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

An owner owns its placements, not a whole region. The active page and mode may both place content in one region. Reconciliation removes a placement only when its exact owner identity leaves or its open state changes.

Resource identity forms the instance key for a resource-bound slot. The same resource in two slots is two independent placements. An update can change a placement's resource, and the placement keeps its instance key. Opening a resource finds the placement that shows it now. A new placement never takes a key that another placement already holds. Region, label, active tab, and registration timing do not define ownership.

When a page declares a document selector, that selector also distinguishes binding instances for its routed resource kind. Two documents sharing a resource ID can occupy different trays. Opening the next document does not replace a moved document or remove the incoming preview while closing the previous preview. Bindings for other resource kinds keep their normal resource identity.

Static views on a resource page also belong to that resource and its declared document selector. Switching resources creates separate view instances. Changing the section or parent route keeps the same instance. Moving one of these views to Side or Bottom preserves its source resource. Closing an optional view changes only that source resource's open state.

Main snapshots use that declared document identity too. Restoring a snapshot reads a static slot's open state only from views of that source document. Another document's view, including one moved into the page, does not reopen a closed source view.

The first page uses the current panel choices to initialize its mode unless that mode already has saved state. Later mode switches restore the destination mode's saved state, or its defaults on its first visit. Opening a panel into closed Side attaches it. Opening a panel into visible floating Side keeps it floating.

## Navigation tree ownership

Mode and page Sidenav contributions carry opaque owner keys. TreeRenderer receives those keys through a configurable movement policy. It does not know mode or page semantics. The policy prevents a customized row from moving across owners while still allowing reorder and hide operations inside one owner.

## Conventions

- Use stable qualified owner ids.
- Use refs instead of parsing contribution ids.
- Never infer ownership from region, resource kind, label, or current tab.
- Never use ownership as a permission decision by itself.
- Return and track every registration disposable.
