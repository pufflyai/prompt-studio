# Contextual Workbench Composition

The Workbench is composed from references between small contributions. This
replaced the earlier model where panel records mixed body, resource eligibility,
and geometry.

## Ownership

| Fact | Owner |
| --- | --- |
| Body and display identity | `ViewContribution` |
| Domain data (collections, palette entries, menu slots) | `ResourceKindDefinition` |
| Tool screens: slots, bindings, open policy, URL path | `PageContribution` |
| Mode furniture and docked region | `PlacementContribution` |
| Menu lifetime | `ViewMenuContribution.owner` |
| Navigation behavior | `NavigationItemContribution.action` |
| Workflow states | `StatusContribution` |

No contribution duplicates another contribution's fact. In particular, a view has
no resource kind, region, or URL. A resource kind has no presentation. A page
binding has no region of its own; the slot it names carries the geometry.

## Identity

Every array contribution has a local `id` and a typed `ref`. The runtime derives
the canonical id:

```txt
${extensionId}.${contributionKind}.${localId}
```

Refs may target the declaring extension, another extension, or a built-in host ref
(`workbenchModes`, `workbenchSlots`, `workbenchCommands`, `workbenchPages`,
`workbenchResourceKinds`). The host normalizes refs before validation and reports
missing targets without changing unrelated contributions.

## Page Composition

A page declares slots (a region plus open policy) and bindings (which view
presents which resource kind in which slot):

```ts
const ticketsPage = definePage({
  id: "tickets",
  title: "Tickets",
  path: "tickets",
  slots: [
    { id: "board", region: "main", view: board.ref, closable: false },
    { id: "ticket", region: "main", cardinality: "many" },
  ],
  bindings: [{ resourceKind: ticket.ref, view: editor.ref, slot: "ticket" }],
});
```

The active page is one resolver input next to the active mode, open resources, and
saved layout. A page outranks mode placements for exactly the regions its slots
declare; every other region keeps the mode's composition. Binding another
extension's kind into your own page is allowed; check shape-validates the foreign
kind ref. Contributing slots or bindings into another extension's page is not.

See [Extension modes and layout](./modes-and-layout.md) for slot policy and
[Choosing a UI surface](./choosing-a-ui-surface.md) for when to reach for each
contribution.

## Host Adapters

The runtime keeps this ownership intact. A host adapter may translate normalized
views, pages, and placements into private renderer and dock metadata, but those
records are not extension authoring APIs. Renderer callbacks also stay private to
the host transport.

## Persistence

Saved state contains canonical view ids and dock choices only: the active slot per
region and per-slot open/closed overrides, scoped per page. It never stores view
bodies, titles, resource definitions, navigation items, settings panels, or
status-bar items. Required placements are reconciled from current contributions
whenever a layout opens. See
[Navigation and layout state](./navigation-and-layout-state.md).
