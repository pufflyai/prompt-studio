# Extension Modes And Layout

Two contributions compose the bench, and each has one job:

- A **mode** is the bench itself. It changes which regions exist and how layout
  behaves. Its placements (static views only) fill the regions no active page
  declares: workbench furniture such as the sessions panel or terminals, which
  survive every page switch.
- A **page** is what is on the bench. It declares slots (a region plus open policy)
  and bindings (which view renders which resource kind into which slot). Anything
  resource-driven is a page.

Not sure which one you need? Read
[Choosing a UI surface](./choosing-a-ui-surface.md) first. The short test: a mode
changes the bench; a page fills it.

## Pages

A page is a named composition declared with `definePage`:

```ts
const ticketsPage = definePage({
  id: "tickets",
  title: l10n("pages.tickets.title", "Tickets"),
  icon: "square-kanban",
  path: "tickets",
  slots: [
    { id: "board", region: "main", view: tickets.ref, closable: false },
    { id: "ticket", region: "main", cardinality: "many" },
    { id: "files", region: "sidenav", follows: "ticket" },
  ],
  bindings: [
    { resourceKind: ticketResourceKind.ref, view: editor.ref, slot: "ticket" },
    { resourceKind: ticketResourceKind.ref, view: files.ref, slot: "files" },
  ],
});
```

A slot is static or bound, never both:

- A **static slot** names a `view`. It may declare `defaultOpen: false` to start
  closed until revealed, and `scope: "page" | "location"` for how long its view
  state lives (default `"page"`; `"location"` keys the state to the page's active
  bound instance, the same instance the URL serializes).
- A **bound slot** has no `view`. The page's `bindings` say which view presents
  which resource kind there. `cardinality: "one"` (the default) swaps each open in
  place; `cardinality: "many"` stacks tabs. `many` slots need a panel region
  (`main`, `side`, or `secondary`); `sidenav` never previews.
- `closable: false` protects a slot's tab while it has content.
- `follows: "<slot-id>"` on a one-cardinality bound slot tracks the active open
  instance of the named `many` slot on the same page. The two slots must share at
  least one bound kind. Planner's files tree follows the active ticket tab this way.
- `order` sorts slots inside a region; the default is declaration order.

Tabs are derived. A slot with content is a tab. Static tabs show the view's title
and icon; bound tabs show the open resource's label. Nothing about presentation is
persisted, so a renamed view can never leave a stale tab label.

A resource reaches a page exactly two ways: as an argument on a page navigation
target, or as an in-page emission placed by the active page's bindings. See
[Navigation](../references/workbench/navigation.md).

## How pages and modes share regions

The rule is region-granular:

- A page owns exactly the regions its slots name, whether or not a slot there is
  open. While the page is active, those regions show the page's composition. A
  declared region whose slots are all closed shows the region placeholder, with
  the page's closed closable slots in the add-panel menu. Mode furniture never
  shows through a declared region.
- Host chrome is the exception, because it is workbench structure rather than
  mode furniture: the dashboard's navigation tree lives in `sidenav` and stays
  there as a region tab next to a page's `sidenav` slot. A page that opens a slot
  in `sidenav` becomes the active tab, so declare one only when the page's own
  tree is what the user needs while working on that page.
- Every other region keeps the mode's composition. This is how furniture survives
  page switches: the tickets page declares only `main` and `sidenav`, so the
  sessions panel in `side` and terminals in `secondary` stay put.
- While no page is active, the mode's placements compose everything.
- Mode chrome (status bar items, activity items, anything `when: { mode }`) is
  never touched by pages.

A page may declare a slot in a furniture region. While active it then owns that
region, even while the slot is closed. Do it deliberately: prefer `main` and
`sidenav` for tool content so furniture stays up.

## Modes

Use a built-in mode ref when furniture belongs in an existing host mode:

```ts
definePlacement({
  id: "terminal-project",
  mode: workbenchModes.project,
  item: { kind: "view", view: terminal.ref },
  region: "secondary",
});
```

Create an extension mode only when the workflow needs its own bench:

```ts
const labMode = defineMode({
  id: "lab",
  label: l10n("modes.lab.label", "Lab"),
  icon: "flask-conical",
});

const workflowPlacement = definePlacement({
  id: "workflow.lab",
  mode: labMode.ref,
  item: { kind: "view", view: workflow.ref },
  region: "side",
  movableTo: ["side", "secondary"],
});
```

Switching modes is a plain command. Target it from a navigation item with the
mode's local id, and use `when: { mode }` for active state:

```ts
defineNavigationItem({
  id: "lab",
  slot: workbenchSlots.projectNavigation,
  label: l10n("modes.lab.label", "Lab"),
  action: {
    kind: "command",
    target: { command: workbenchCommands.switchMode, params: { modeId: labMode.id } },
  },
});
```

`extensions/extension-lab/src/renderers/ui-contributions.ts` shows the full
mode-plus-pages shape: one mode with furniture placements, and pages that swap only
the regions they declare.

## Placement rules

A placement item is always `{ kind: "view", view }`: a static view in a mode.

- `region` is one of `sidenav`, `main`, `secondary`, or `side`.
- `movableTo` lists allowed regions and must include the initial region.
- `defaultOpen: false` leaves an optional placement closed in a new layout.
- `required: true` makes the placement structural and cannot be combined with
  `defaultOpen: false`.
- The same view may appear only once in one mode.

## State lifetime

Where a panel is declared decides how long its view state lives:

| Declared as | State lives | Example |
| --- | --- | --- |
| Mode placement | Across every page in the mode | The project terminal, the sessions panel |
| Page slot (`scope: "page"`, the default) | Across all of one page's locations | A notes pad shared by every workspace |
| Page slot (`scope: "location"`) | Per `(page, active bound instance)` | Per-workspace terminal sets |

A scope switch is a swap, never a teardown: keep-alive views keep background
instances running. Bound slots need no scope; their identity is already per
instance.

## Persistence

Saved layout stores arrangement the user chose: the active slot per region and
per-slot open/closed overrides, scoped per page. Titles, icons, and tab identity
are never stored. Status-bar, navigation, and settings contributions are host
chrome and are not stored as dock layout. See
[Navigation and layout state](./navigation-and-layout-state.md) for reconciliation
and reset.
