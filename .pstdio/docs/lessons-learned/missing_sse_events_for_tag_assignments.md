# Missing SSE events for `ticket_tag_assignments`

## What went wrong

Toggling a tag on a ticket via the dashboard had no visible effect. The PATCH request succeeded (verified via API), but the tag selector continued showing "No tags selected". The e2e test for this feature failed consistently.

## Why

Two bugs contributed:

1. **No SSE emission:** The `updateTicketHandler` called `ticketsService.assignTags()` to update `ticket_tag_assignments` in the database, but only emitted an SSE event for the `tickets` table. The dashboard derives `tagIds` from the `ticket_tag_assignments` collection via `useLiveQuery`, so without a sync event for that table the UI never learned about the change.

2. **Wrong column name:** The `use-project-tickets` hook read `ta.tag_id` but the actual database column is `ticket_tag_id` (defined in `pstdio-db/src/db/schemas.pg.ts`). Since synced collections use raw DB column names, `ta.tag_id` silently returned `undefined` and tags never displayed — even on initial page load via full-state sync.

## How it was solved

1. Added SSE event emission in `update-ticket.ts`: emit `"delete"` events for old assignments before the DB update, then emit `"set"` events for new assignments after.

2. Fixed the column reference in `use-project-tickets.ts` from `ta.tag_id` to `ta.ticket_tag_id`.

## Key takeaway

When a handler modifies rows in a synced table, it must emit SSE events via `eventBus.emit` for that table. Check `get-full-state.ts` for the list of synced tables. When accessing synced collection fields, always cross-check column names against the Drizzle schema.
