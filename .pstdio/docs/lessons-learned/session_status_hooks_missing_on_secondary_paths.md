# Session hooks missing on secondary status-transition paths

## What went wrong

Session lifecycle hooks were not consistently triggered when status changed outside the main status endpoint. Some paths emitted DB + SSE updates but skipped the hook call, so automation tied to `post-session-success`, `post-session-fail`, or `post-session-resume` did not run.

## Why

Status transitions were implemented in multiple places:

1. `PATCH /sessions/:id/status`
2. Agent process exit handling
3. Startup orphan resolution
4. Session create fallback on spawn failure
5. Approval and follow-up transitions back to `in_progress`
6. Ticket-attempt fallback on spawn failure

Only some paths called the lifecycle hook functions. There was no explicit cross-path contract in docs/tests, so regressions were easy to miss.

## How it was solved

1. Added missing hook calls in the uncovered transitions (`approve-session`, `create-session` failure fallback, and ticket-attempt failure fallback).
2. Added regression tests that assert hook side effects for those paths.
3. Updated architecture docs with a single multi-path status-transition contract.

## Key takeaway

When status can change from multiple entry points, every path must execute the same side effects (DB update, sync event, lifecycle hook) and have explicit regression coverage for each path.
