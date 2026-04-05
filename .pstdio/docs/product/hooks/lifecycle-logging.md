---
status: "draft"
created: "2026-04-02T00:00:00Z"
---

# Proposal: Hook Lifecycle Logging

## Problem

Debugging hook behavior is currently expensive because lifecycle visibility is fragmented:

1. Non-blocking hook failures are often swallowed (`catch(() => {})`) and not surfaced anywhere durable.
2. Deferred `post-attempt-status-*` delivery has no trace for queue/write/consume outcomes.
3. Only `post-worktree-create` has a persisted log path (`startup_log`), while other hooks rely on transient stdout/stderr.
4. There is no stable correlation key to connect a status transition, session completion, and deferred hook execution.

## Goals

1. Provide one consistent, structured log contract for all hook lifecycle events.
2. Make deferred attempt-status queue behavior observable end-to-end.
3. Keep logging non-blocking and best-effort (never break the lifecycle action).
4. Support fast local debugging from CLI without opening the database.

## Non-Goals

- Replacing user-defined hook script logging.
- Introducing remote/SaaS log shipping.
- Streaming full stdout/stderr for every successful hook run.

## Scope

- Hook execution initiated by API and CLI code paths.
- Deferred attempt-status queue events (queue, overwrite, consume, skip).
- Manual `pstdio hooks run` executions.

## Proposed Contract

### 1) Structured event model

Every hook lifecycle action writes an NDJSON event with a stable `hook_run_id` and context fields.

Common fields:

- `timestamp` (ISO 8601)
- `event` (event type)
- `hook_run_id` (`hr_<id>`)
- `hook_name`
- `project_id`
- `workspace_id` (when available)
- `workspace` (when available)
- `ticket` (when available)
- `session_id` (when available)
- `status_change_id` (when available)

Event types:

- `hook.queue.set` — deferred post-hook was queued.
- `hook.queue.overwrite` — previous deferred post-hook for same session key replaced.
- `hook.queue.consume` — deferred entry consumed for delivery.
- `hook.queue.miss` — no deferred entry found at consume time.
- `hook.run.start` — script execution started.
- `hook.run.finish` — script completed.
- `hook.run.skipped` — script not found.
- `hook.run.timeout` — script exceeded timeout.
- `hook.run.spawn_error` — process could not be started.

### 2) Result fields on terminal run events

`hook.run.finish`, `hook.run.timeout`, and `hook.run.spawn_error` include:

- `result`: `success | failed | skipped | timeout | spawn_error`
- `exit_code` (when available)
- `blocking` (boolean)
- `duration_ms` (when available)
- `stdout_bytes`
- `stderr_bytes`
- `stdout_preview` (truncated, optional)
- `stderr_preview` (truncated, optional)

### 3) Correlation rules

- `hook_run_id` is generated at execution start.
- Deferred attempt-status entries persist `status_change_id`, `attempt_status_from`, and `attempt_status_to` in log events.
- Queue key is always session id (`session_id`) to match existing "last status wins per session" semantics.

### 4) Storage and retention

Store logs under:

- `~/.pstdio/hook-logs/<project-id>/<YYYY-MM-DD>.ndjson`

Retention:

- Keep the most recent 14 daily files per project.
- Cleanup is best-effort and never fails hook operations.

### 5) Log safety defaults

- Always store metadata.
- Store stdout/stderr byte counts always.
- Store output previews only when:
  - `result !== "success"`, or
  - explicit verbose mode is enabled.
- Preview content is truncated (default 4KB per stream).

## CLI UX Proposal

Add:

`pstdio hooks logs`

Options:

- `--project-id <id>` (optional if cwd resolves a project)
- `--hook <hook-name>`
- `--workspace <workspace-shorthand-or-id>`
- `--session-id <session-id>`
- `--status-change-id <id>`
- `--since <duration>` (for example `30m`, `2h`, `1d`)
- `--tail` (follow mode)
- `--json` (raw NDJSON pass-through)

Default output is a compact table with timestamp, hook, result, and correlation columns.

## Config Proposal

Project config extension:

```json
{
  "hooks": {
    "logging": {
      "enabled": true,
      "verbose": false,
      "preview_bytes": 4096,
      "retention_days": 14
    }
  }
}
```

Defaults should apply when this block is absent.

## Implementation Notes

Primary implementation points:

1. `packages/pstdio-plugins/src/hooks/dispatcher.ts`
   - emit `hook.run.*` events around execution lifecycle.
   - include timeout and spawn-failure logging paths.
2. `packages/pstdio-api/src/features/hooks/post-hook-store.ts`
   - emit `hook.queue.*` events on queue/overwrite/consume/miss.
3. `packages/pstdio-api/src/features/hooks/session-hooks.ts`
   - log deferred delivery decisions on terminal session status.
4. `packages/pstdio-api/src/lib/`
   - add shared `hook-log.ts` utility for append + retention.
5. `packages/pstdio/src/adapters/cli/commands/hooks/`
   - add `hooks logs` command for reading/filtering local log files.

## Test Plan

1. Unit tests for log writing, truncation, and retention cleanup.
2. Unit tests for queue lifecycle events (`set`, `overwrite`, `consume`, `miss`).
3. Integration tests for:
   - blocking pre-hook failure produces `hook.run.finish` with `result=failed`
   - deferred post-hook queue/delivery emits full event chain
   - non-blocking hook errors are logged even when caller ignores return value
4. CLI tests for `pstdio hooks logs` filtering and tail mode.

## Rollout Plan

1. Ship logging utility + event emission in hook runtime and deferred queue.
2. Add `pstdio hooks logs` command.
3. Update hook docs with troubleshooting workflow and sample queries.
4. Add e2e regression that verifies deferred attempt-status timeline is visible in logs.
