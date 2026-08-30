# Extension Navigation And Layout State

What the dashboard remembers about extension UI, how it reconciles that state when
contributions change, and how to reset it.

## The navigable location

The unit of navigation is `(page, resource?)`. The URL, the history stack, and the
boot-time restore all store and replay that pair; nothing stores a bare resource
that needs a screen found for it later.

- The URL carries the page and the active bound instance only:
  `/projects/{project}/{extension-id}/{path}`, with the resource serialized after
  the page path. Refresh restores that pair. Other pinned tabs are session state
  and are gone after a reload.
- Page activations and pinned opens push a history entry; preview swaps replace
  the current one.
- On boot, a URL deep link wins over the persisted last location. With neither,
  the host lands on the first project-navigation item with a page target, or on
  `workbenchPages.start`.

See [Navigation](../references/workbench/navigation.md) for targets, emissions,
and the URL scheme.

## What page layout state contains

Page layout state stores arrangement only, scoped per project and page
(`project/{projectId}/page/{pageId}`):

- the active slot per region
- per-slot open/closed overrides: a closed closable slot, or a
  `defaultOpen: false` slot the user opened

Nothing else is persisted. Titles, icons, and tab identity are read from
contributions at render time, so a renamed view or a re-ordered slot can never
leave stale persisted labels. Open resources are session state, not layout; the
URL carries the active instance, so exactly the active `(page, resource)` pair
returns after a reload.

View-internal state (a terminal set, a filter, a scroll position) is not layout
state either. The view owns that data; the host only hands the view a scope key
derived from the slot's declared `scope` (`page` or `location`).

Regions a page leaves undeclared carry across the scope rotation, so mode
furniture (the sessions panel, terminals) keeps its own arrangement while the user
switches pages.

## Reconciliation

Layout state must survive extension upgrades without going stale. The dashboard
keeps a compatibility fingerprint per project (version 5) built from the
contributions that shape layout: each view's body kind, its mode placements, and
the page slot declarations that reference it (`pageId:slotId:region`). Page slots
joined the fingerprint when pages were introduced, so a changed page composition
reconciles stored layouts without churning unrelated arrangement.

When the fingerprint changes, the dashboard transforms every stored layout for the
project: placements of removed contributions are dropped, moved contributions are
re-seeded into their declared regions, and user choices that are still valid are
kept. The fingerprint is a compatibility marker, not a store; it decides when to
reconcile, never what the user chose.

## Reset

Each extension registers a dashboard command, `Reset <extension> layout`,
available from the command palette. It reseeds that extension's stored layouts and
the live bench from the current declarations. Nothing else changes.

There is no CLI reset. Layout state lives in the browser (`localStorage`), and a
headless process has no path to browser storage. Adding one would mean moving
layout state server-side for a debugging convenience. The model also shrinks what
reset is for: titles, icons, and tab identity are never persisted, so the stale
states that used to motivate a reset tool are unrepresentable. What remains
resettable is arrangement the user actually chose.

## Related docs

- [Choosing a UI surface](./choosing-a-ui-surface.md)
- [Extension modes and layout](./modes-and-layout.md)
- [Extension Workbench Composition](../architecture/extension-workbench-composition.md)
