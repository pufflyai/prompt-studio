# @pstdio/sdk

## 0.2.0

### Minor Changes

- 1d384f8: Move `renderPrompt` off the SDK root export and keep it available from `@pstdio/sdk/prompts`.
- 1d384f8: Split SDK ticket attempt helpers into session-backed createAttempt and workspace-only createWorkspace.

### Patch Changes

- 1d384f8: Add a `createSession` plugin helper that automatically injects `project_id` from plugin context.
- 1d384f8: Make session hook contexts expose `ticket` and `workspace` as full objects when a workspace is linked.
- 1d384f8: Add a workspacesForTicket plugin helper for ticket-scoped workspace lookups.
- 1d384f8: Publish the SDK from built dist artifacts instead of raw source.
- 1d384f8: Surface rich ticket and workspace hook objects.
- 1d384f8: Expose ticket/workspace objects in session hook contexts.
- 1d384f8: Add a plugin follow-up helper and fix review lifecycle session routing.
- 1d384f8: Include ticket status_name in session hook ticket context and SDK typing.
- 1d384f8: Consolidate plugin runtime boundaries: introduce pstdio-api-contracts for shared API types, make SDK and API consume contracts, move hook dispatch into pstdio-plugins/hooks, delete pstdio-hooks
- 1d384f8: Keep SDK root imports scoped to shared client and types.
- 1d384f8: Normalize plugin helpers so `ticketId` and `workspaceId` accept either canonical IDs or shorthand refs.
- 1d384f8: Narrow plugin action `ctx.target` by `targetType` discriminant — no cast needed.
- 1d384f8: Align TypeScript dependency ranges to ^5.9.3 across workspace packages.
- 1d384f8: Update setTicketStatus helper input to { ticket, status }.
