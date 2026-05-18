---
"@pstdio/sdk": minor
"pstdio": minor
---

Add reject semantics to extension hooks. Hook handlers can now return `ctx.events.reject({ reason, code?, data? })` to short-circuit a gated event; `EventDeliveryResult` exposes the rejection. Adds lifecycle event refs (`ticketEvents.preCreation/created/preStatusChange/statusChanged/preArchive/preDeletion/deleted`, `worktreeEvents.preCreate`, `attemptStatusEvents.preChange/changed`) and removes the unused `builtin` value from `extension_source_kind`.
