# Extension Modes And Layout

A mode is a named way of working. Extension API alpha.4 separates the mode identity
from the placement records that arrange UI.

Use a built-in mode ref when the UI belongs in an existing host mode:

```ts
definePlacement({
  id: "tickets-project",
  mode: workbenchModes.project,
  item: { kind: "view", view: tickets.ref },
  region: "main",
});
```

Create an extension mode only when the workflow needs its own mode identity:

```ts
const reviewMode = defineMode({
  id: "review",
  label: "Review",
  icon: "check-check",
});

const reviewQueue = definePlacement({
  id: "review-queue",
  mode: reviewMode.ref,
  item: { kind: "view", view: queue.ref },
  region: "main",
  defaultOpen: true,
});

export default defineExtension({
  modes: [reviewMode],
  views: [queue],
  placements: [reviewQueue],
});
```

## Direct Views And Resource Slots

A placement item is either:

- `{ kind: "view", view }` for a mode-wide view
- `{ kind: "resource-slot", slot }` for views bound to the active resource

The resource kind defines the slot, `resourceViews` binds view capabilities to it, and
the placement decides its region. This keeps resource meaning separate from geometry.

## Placement Rules

- `region` is one of `sidenav`, `main`, `secondary`, or `side`.
- `movableTo` lists allowed regions and must include the initial region.
- `defaultOpen: false` leaves an optional placement closed in a new layout.
- `required: true` makes the placement structural and cannot be combined with
  `defaultOpen: false`.
- A required resource-slot placement needs cardinality `one`.
- The same view or semantic slot may appear only once in one mode.

Saved layout stores user choices for docked placements. Status-bar, navigation, and
settings contributions are host chrome and are not stored as dock layout.

## Persistence Migration

The alpha.4 migration rewrites known alpha.3 view ids to canonical view ids and removes
chrome entries from saved dock layout. It runs once behind a marker. Unknown or invalid
entries are discarded instead of being kept as hidden compatibility state.
