# Temporary: Resolve Timeline saved-view fields without loading ticket rows

Proposed: 2026-10-16

## Intended design

Saved views need a collection's field definitions independently of its rendered rows. Timeline should read its ticket snapshot once, then use those same fields for its filters and saved views.

## External limitation

The published SDK stores saved views against a Kanban or DataTable contribution. The host resolves a board's fields by running its row query. Planner's existing hidden `timeline-tickets` contribution reused the ordinary Tickets query, so reading Timeline's saved views loaded tickets, workspace session badges, and a second execution plan. The iframe does not render this hidden board; it renders its own timeline query.

The released SDK has no separate collection schema contribution. A clean standalone schema contract requires a platform release before the portable extension can consume it.

## Decision

Keep the existing hidden saved-view registration and give it a schema query. That query reads status, tag, and milestone definitions, returns the same filter attributes as Timeline, and supplies an empty row array required by the published Kanban query contract. Share the attribute builders with the real Timeline query. Do not add another stored schema, ticket snapshot, or private host API.

Return the saved views with Timeline's initial snapshot and subscribe that snapshot to saved-view changes. The host remains responsible for saved-view validation, storage, and events through `ctx.views`.

## Limitations

This is a temporary adapter for saved-view metadata, not a native timeline renderer. The hidden contribution is not a ticket-list navigation target. The actual Tickets board and Timeline retain their own row queries and actions.

## Removal

When a published SDK supports a collection's field definitions and saved views without running its renderer query, migrate Timeline to that contract and remove the hidden Kanban registration and its schema adapter. The [shared timeline renderer PRD](../requirements/extensions/0002-timeline-renderer.md) must include this independent schema contract.
