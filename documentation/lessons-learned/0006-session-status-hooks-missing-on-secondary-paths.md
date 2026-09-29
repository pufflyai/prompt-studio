# Keep session status side effects in one service

## What went wrong

Session status changed through several paths: the status endpoint, process exit, startup recovery, spawn failure, approval, and follow-up. Some paths updated the database and sent sync events but omitted lifecycle hooks. Automation therefore depended on how a session reached the same status.

## Why

Callers each implemented part of the transition. Adding a hook call to one endpoint did not protect process-exit or recovery paths from the same omission.

## Current contract

The [session service](../../packages/pstdio-api/src/services/session-service.ts) owns status mutations, sync events, and lifecycle callbacks. Callers use its transition, resume, and queue methods rather than writing directly to the database and emitting events themselves. Queue operations also preserve the durable queue entry that a queued session requires.

The service logs `sync_emit_skipped` when a guarded write returns no updated row. That makes a skipped transition visible; it does not replace the requirement to keep side effects together.

See the [session status lifecycle](../references/architecture/0019-session-status-lifecycle.md) for the full contract.

## Key takeaway

When several entry points change the same state, put its required side effects in the service that owns that state. Cover secondary paths such as startup recovery and spawn failure as well as the normal endpoint.
