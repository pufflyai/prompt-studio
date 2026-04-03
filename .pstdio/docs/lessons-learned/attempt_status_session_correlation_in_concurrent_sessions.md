# Attempt-status session correlation under concurrent sessions

## What went wrong

We initially treated `PSTDIO_SESSION_ID` as a universally reliable mechanism for correlating `workspaces set-status` calls with the originating session.

That assumption held for Claude Code, but not for OpenCode in all cases.

## Why

1. Provider execution models differ:
   - Claude Code uses a spawned child process per session/resume call, so per-session env injection is straightforward.
   - OpenCode uses a shared long-lived server process, so process env is not a safe per-session correlation channel.
2. A workspace can have multiple active sessions at the same time, so deriving session identity from workspace context alone is ambiguous.
3. Deferred post-attempt-status hook delivery is session-bound by design, and queue behavior is intentionally "last status wins" per session.

## How it was solved

1. Kept the API contract explicit: `session_id` remains the canonical correlation key when present on attempt-status updates.
2. Documented provider-aware behavior:
   - Claude Code path uses env propagation.
   - OpenCode path uses explicit prompt/instruction injection to tell agents to pass `--session-id`.
3. Kept queue semantics unchanged (single queued post-hook entry per session, overwrite on subsequent status changes in the same session).

## Open limitation

There is no mechanism to enforce that callers pass `--session-id` in Open Code. The CLI accepts the flag but nothing prevents a caller from omitting it. This means session correlation for attempt-status updates is best-effort: it works when the caller cooperates, but the system cannot guarantee it.

## Key takeaway

Session correlation must be treated as an explicit contract, not inferred context. In concurrent, multi-provider systems, any session-bound side effect should rely on explicit identity propagation that is valid for every provider architecture. For attempt status specifically, `session_id` exists to link an agent-triggered change back to its originating session; user-triggered status updates can remain sessionless. Crucially, this contract is advisory — there is no compile-time or runtime enforcement that open callers will supply a session ID, so consuming code must always handle the absent-session case gracefully.
