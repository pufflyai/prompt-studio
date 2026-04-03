---
status: "draft"
created: "2026-04-02T00:00:00Z"
---

# Proposal: Attempt Status Session Correlation Across Agents

## Problem

`pstdio workspaces set-status` updates attempt status at the workspace level, but deferred `post-attempt-status-*` hook delivery is session-bound.

This requires a reliable session identity (`session_id`) when the status change is initiated by an agent.
The only purpose is to map that status change back to the originating agent session so deferred post-hook delivery is tied to the correct session.

## Constraints

1. Multiple sessions can run concurrently in the same workspace.
2. `post-attempt-status-*` queue semantics are intentionally "last status wins" per session.
3. Agent providers have different process models:
   - Claude Code: process-per-session/prompt over stdio.
   - OpenCode: shared long-lived HTTP server process.

Because of (1), server-side inference from workspace alone is ambiguous. Because of (3), env propagation is not uniform across providers.

## Scope

Define a provider-aware strategy to ensure session identity is available when calling attempt-status transitions from agent flows.

## Non-Goals

- Do not change queue semantics (keep last status wins).
- Do not enforce one active session per workspace.
- Do not require global provider architecture changes (for example one OpenCode server per session).

## Proposed Contract

### 1) Canonical API contract

`PATCH /v1/workspaces/{id}/attempt-status` keeps `session_id` optional.

- If `session_id` is provided, queue deferred `post-attempt-status-*` hook against that session.
- If `session_id` is omitted, still apply workspace attempt-status change, but do not enqueue deferred post hook delivery.

This preserves workspace-level updates while keeping session-bound side effects explicit and safe under concurrency.

### 2) CLI contract

`pstdio workspaces set-status` supports:

- `--status <name>` (required)
- `--session-id <session-id>` (optional, recommended in agent flows)

If `--session-id` is omitted, the CLI can fall back to `PSTDIO_SESSION_ID` when that environment variable is set.

Agent-driven transitions should still pass `--session-id` whenever available.
User-driven transitions can omit `--session-id`.

### 3) Agent-provider strategy

#### Claude Code

Inject `PSTDIO_SESSION_ID` into spawned/resumed process env. `pstdio workspaces set-status` can fall back to that env var, and hook scripts can still pass `--session-id "$PSTDIO_SESSION_ID"` explicitly when desired.

#### OpenCode

Do not rely on process env for per-session identity due shared-server architecture.

Inject an explicit instruction block into the spawned/resumed prompt with the concrete session id, for example:

```txt
When updating attempt status, always run:
pstdio workspaces set-status --status <status> --session-id <api-session-id>
```

This makes session correlation explicit at the command level.

## Why this design

- Works with concurrent sessions in the same workspace.
- Preserves current queue semantics.
- Avoids high-cost OpenCode architecture changes.
- Keeps behavior consistent with existing optional `session_id` API contract.

## Risks

1. Prompt compliance risk for OpenCode (instruction may be ignored).
2. Legacy hooks/scripts that omit `--session-id` will not trigger deferred post-attempt-status delivery.

## Mitigations

1. Add clear docs in architecture + hook environment references.
2. Keep `--session-id` support as an explicit contract and include examples in bundled/default hooks.
3. Add regression tests for:
   - queued delivery with provided `session_id`
   - no queue when `session_id` is missing
   - overwrite behavior for repeated status changes in same session

## Rollout Plan

1. Document provider-specific session identity behavior.
2. Ensure OpenCode prompt instruction injection includes session-id usage guidance.
3. Keep existing queue behavior unchanged.
4. Update default hook templates/examples to use `--session-id "$PSTDIO_SESSION_ID"` where applicable.
