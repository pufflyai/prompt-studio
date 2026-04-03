# Attempt-status session correlation under concurrent sessions

## What went wrong

We initially treated `PSTDIO_SESSION_ID` as a universally reliable mechanism for correlating `workspaces set-status` calls with the originating session.

That assumption held for Claude Code, but not for OpenCode when session identity had to cross the shared server boundary into shell execution.

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
   - OpenCode path should use a `shell.env` bridge that receives OpenCode `sessionID`, resolves it to the matching pstdio session, and exports `PSTDIO_SESSION_ID`.
3. Kept queue semantics unchanged (single queued post-hook entry per session, overwrite on subsequent status changes in the same session).
4. Added explicit fallback behavior: if `session_id` is absent, post-attempt-status hooks execute immediately after the status commit instead of being queued.

## Open limitation

OpenCode's `sessionID` / `callID` values are optional in the `shell.env` hook input, so some execution paths may still lack session context. Today this also requires a pstdio-managed OpenCode plugin. As of April 3, 2026, upstream PR `anomalyco/opencode#9289` is still open, so there is not yet a built-in no-plugin path we can depend on.

## Key takeaway

Session correlation must be treated as an explicit contract, not inferred context. In concurrent, multi-provider systems, any session-bound side effect should rely on an identity bridge that matches the provider's runtime model. For attempt status specifically, `session_id` exists to link an agent-triggered change back to its originating session for deferred delivery; user-triggered status updates can remain sessionless and still run post hooks immediately. OpenCode should therefore bridge its own session identity into `PSTDIO_SESSION_ID` at shell-execution time instead of relying on prompt wording or ambient server env.
