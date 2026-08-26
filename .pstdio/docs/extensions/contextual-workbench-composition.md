# Contextual Workbench Composition

Extension API alpha.4 composes the Workbench from references. It replaces the previous
model where panel records mixed body, resource eligibility, and geometry.

## Ownership

| Fact | Owner |
| --- | --- |
| Body and display identity | `ViewContribution` |
| Resource semantics | `ResourceKindDefinition` and `ResourceViewContribution` |
| Mode and docked region | `PlacementContribution` |
| Menu lifetime | `ViewMenuContribution.owner` |
| Navigation behavior | `NavigationItemContribution.action` |
| Workflow states | `StatusContribution` |

No contribution duplicates another contribution's fact. In particular, a view has no
resource kind or region. A resource-view binding has no region. A placement has no UI
body.

## Identity

Every array contribution has a local `id` and a typed `ref`. The runtime derives the
canonical id:

```txt
${extensionId}.${contributionKind}.${localId}
```

Refs may target the declaring extension, another extension, or a built-in host ref. The
host normalizes refs before validation and reports missing targets without changing
unrelated contributions.

## Resource Composition

A resource kind declares semantic slots with cardinality and access. Its owner binds
views with `resourceViews`. Another extension can bind to a public slot. The active
mode's placements choose where those slots appear.

```ts
const ticket = defineResourceKind({
  id: "ticket",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "inspector", cardinality: "many", access: "public" },
  ],
});

const primary = resourceSlotRef(ticket.ref, "primary");

defineResourceView({
  id: "editor",
  resourceKind: ticket.ref,
  slot: primary,
  view: editor.ref,
});

definePlacement({
  id: "ticket-primary",
  mode: workbenchModes.project,
  item: { kind: "resource-slot", slot: primary },
  region: "main",
  required: true,
});
```

The primary slot is owner-only. External bindings to owner-only or missing slots are
rejected. A cardinality-one slot may have one required placement. Cardinality-many
slots remain optional collections.

## Host Adapters

The runtime keeps alpha.4 ownership intact. A host adapter may translate normalized
views and placements into private renderer and dock metadata, but those records are not
extension authoring APIs. Renderer callbacks also stay private to the host transport.

## Persistence

Saved state contains canonical view ids and dock choices only. It never stores view
bodies, resource definitions, navigation items, settings panels, or status-bar items.
Required placements are reconciled from current contributions whenever a layout opens.
