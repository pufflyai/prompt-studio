---
status: "draft"
created: "2026-04-03T12:00:00Z"
---

# Proposal: Track Which Session Invoked Which pstdio CLI Command

## Problem

We need a reliable way to answer: "which pstdio session invoked this CLI command?"

- Claude Code can already propagate `PSTDIO_SESSION_ID` per spawned process.
- OpenCode uses a shared `opencode serve` process, so process env is not a reliable per-session channel.
- OpenCode PR #13662 (merged to `dev` on 2026-02-18) adds optional `sessionID` and `callID` to `shell.env` hook input, which is the right temporary bridge.

## Goals

1. Tag mutating CLI commands with session identity when available.
2. Keep manual user commands working with no required session flag.
3. Use one OpenCode plugin bridge to map OpenCode session identity to `PSTDIO_SESSION_ID`.
4. Keep the solution easy to remove once OpenCode exposes `OPENCODE_SESSION_ID` natively.

## Non-Goals

- Do not block commands when session identity is unavailable.
- Do not infer session identity from workspace alone.
- Do not wait for upstream native `OPENCODE_SESSION_ID` before shipping a temporary fix.

## Existing Behavior (Already Implemented)

`pstdio workspaces set-status` already supports explicit session id plus env fallback:

```ts
const sessionId = argv["session-id"] ?? deps.env().PSTDIO_SESSION_ID;
await deps.updateAttemptStatus(API_URL, workspace.id, argv.status, sessionId);
```

Source: `packages/pstdio/src/adapters/cli/commands/workspace/set-status.ts`.

This fallback is covered by tests:

- `falls back to PSTDIO_SESSION_ID from env`
- `prefers explicit session id over PSTDIO_SESSION_ID from env`

Source: `packages/pstdio/src/adapters/cli/commands/workspace/set-status.test.ts`.

## CLI Commands That Benefit From Session Tagging (out of scope for this change)

The following are all non-read-only CLI commands that mutate DB state, workspace state, files, or agent/session lifecycle and therefore benefit from session tagging.

### Projects

- `pstdio projects create`
- `pstdio projects link`
- `pstdio projects unlink`
- `pstdio projects delete`

### Agents

- `pstdio agents setup`
- `pstdio agents update`
- `pstdio agents remove`
- `pstdio agents install-skills`

### Hooks

- `pstdio hooks create`
- `pstdio hooks run`

### Statuses and Tags

- `pstdio statuses create`
- `pstdio statuses set-default`
- `pstdio statuses delete`
- `pstdio tags create`
- `pstdio tags delete`

### Templates

- `pstdio templates create`
- `pstdio templates update`
- `pstdio templates delete`
- `pstdio templates write`

### Tickets

- `pstdio tickets write`
- `pstdio tickets create`
- `pstdio tickets pull`
- `pstdio tickets save`
- `pstdio tickets update`
- `pstdio tickets implement`
- `pstdio tickets update-when-attempt-status`
- `pstdio tickets archive`
- `pstdio tickets delete`
- `pstdio tickets worktrees remove-all`

### Sessions

- `pstdio sessions create`
- `pstdio sessions follow-up`
- `pstdio sessions approve`
- `pstdio sessions deny`
- `pstdio sessions stop`
- `pstdio sessions archive`

### Workspaces

- `pstdio workspaces create`
- `pstdio workspaces set-status`
- `pstdio workspaces merge`
- `pstdio workspaces delete`

## Temporary OpenCode Solution (Plugin Bridge)

Use OpenCode `shell.env` hook to bridge optional OpenCode runtime IDs into pstdio env:

- Input: `sessionID` (optional), `callID` (optional)
- Output env:
  - `PSTDIO_SESSION_ID` (resolved via OpenCode->pstdio session mapping)

Behavior:

1. If mapping succeeds, commands run with `PSTDIO_SESSION_ID` set.
2. If mapping fails or `sessionID` is absent, command still runs untagged.
3. `callID` is stored for diagnostics only.

## Required New API Endpoint (Missing Piece)

To set `PSTDIO_SESSION_ID`, the OpenCode plugin needs a supported way to map OpenCode executor session identity to a pstdio session.

### Endpoint

- `POST /v1/sessions/resolve-session-id`

Request body:

```json
{
  "agent": "opencode",
  "agent_session_id": "<opencode-session-id>",
  "cwd": "<optional-shell-cwd>"
}
```

Response body:

```json
{
  "session_id": "<pstdio-session-id-or-null>"
}
```

### Matching Rules

1. Match by `sessions.agent = "opencode"` and `sessions.agent_session_id = agent_session_id`.
2. Prefer active sessions (`in_progress`, `awaiting_input`) over terminal sessions.
3. If `cwd` is provided and multiple matches exist, prefer exact `sessions.cwd` match.
4. If still ambiguous, return HTTP `409` with `{ "error": "Ambiguous session match" }`.
5. If no match exists, return `200` with `{ "session_id": null }` (plugin proceeds without `PSTDIO_SESSION_ID`).

### Why This Endpoint

- Keeps OpenCode plugin logic thin and stateless.
- Centralizes mapping policy inside pstdio API where session records already exist.
- Avoids brittle client-side heuristics and DB/file access from plugin code.

## Implementation Shape

### 1) Unified CLI Tag Resolution

Add one shared resolver in CLI runtime used by mutating commands and command telemetry:

- precedence: explicit command flag (where present) -> `PSTDIO_SESSION_ID` -> undefined

### 1b) OpenCode Plugin Resolution Flow (new)

1. Plugin receives `input.sessionID` from OpenCode `shell.env`.
2. Plugin calls `POST /v1/sessions/resolve-session-id` with `agent_session_id=input.sessionID` and `cwd=input.cwd`.
3. If response includes `session_id`, plugin exports `PSTDIO_SESSION_ID=<session_id>`.
4. If response is null/absent, plugin does not set `PSTDIO_SESSION_ID`.

### 2) Command Invocation Tracking (out of scope)

Persist command invocation records for mutating commands, including:

- `command` (normalized command path)
- `args` (safe serialized args)
- `cwd`
- `pstdio_session_id` (resolved)
- `opencode_executor_session_id` (optional)
- `opencode_executor_call_id` (optional)
- timestamp and exit status

Storage can be in pstdio API/DB (preferred) or a local CLI log file, but DB-backed querying is the target behavior.

### 3) Keep Existing Attempt-Status Correlation Contract

No behavior change for `workspaces set-status` semantics:

- still accepts `--session-id`
- still falls back to `PSTDIO_SESSION_ID`
- still queues deferred post-attempt-status hooks when `session_id` exists

### 4) Extend Agent Setup To Install Plugins

Extend agent setup so OpenCode session bridge installation is first-class:

- `pstdio agents setup opencode` installs both skills and required OpenCode plugin artifacts.
- Add explicit plugin installation command for idempotent reruns, for example:
  - `pstdio agents install-plugins <agent-id>`
- Plugin install should be supported for project-local and global setups, matching existing skills install model.
- Agent config should include plugin-install metadata/path overrides (similar to `binary` and `skills_dir`).

## Ticket Draft

**Title**
Track session-tagged CLI invocations and install OpenCode session-bridge plugin

**Summary**
Add end-to-end session-aware command tagging for mutating `pstdio` CLI commands, using an OpenCode `shell.env` bridge as temporary transport for OpenCode sessions.

**Scope**

1. Add `POST /v1/sessions/resolve-session-id` endpoint in pstdio API.
2. Add shared session-tag resolution utility in CLI.
3. Add command invocation tracking for all mutating commands listed above.
4. Keep/verify current `workspaces set-status` fallback behavior.
5. Add OpenCode plugin artifact(s) for `shell.env` session bridge.
6. Extend agent setup/install flows to install plugins (project-local + global).
7. Document OpenCode plugin bridge setup and troubleshooting.

**Acceptance Criteria**

1. `POST /v1/sessions/resolve-session-id` returns the mapped pstdio session id for valid OpenCode session ids.
2. Endpoint returns `session_id: null` when no mapping exists and `409` on ambiguous matches.
3. Mutating commands record invocation entries with session tags when `PSTDIO_SESSION_ID` exists.
4. OpenCode runs with bridge plugin set `PSTDIO_SESSION_ID` when `sessionID` can be mapped.
5. `workspaces set-status` continues to prefer `--session-id` over env fallback.
6. `pstdio agents setup opencode` installs required plugin artifacts by default.
7. Plugin install is idempotent and does not overwrite user customizations unexpectedly.
8. Docs clearly state optionality caveat: OpenCode `sessionID`/`callID` may be absent in some paths.

**Test Plan**

1. API tests for `POST /v1/sessions/resolve-session-id`: found, not found, ambiguous (`409`), and `cwd` tie-break.
2. Unit tests for session-tag resolver precedence.
3. Unit tests for command invocation recorder payload shape.
4. Existing + updated `workspaces set-status` fallback tests stay green.
5. Agent setup/install tests verify OpenCode plugin installation in local/global modes.
6. Integration test: simulated OpenCode env (`OPENCODE_EXECUTOR_*`, mapped `PSTDIO_SESSION_ID`) produces tagged command record.

## Rollout

1. Ship plugin bridge + command tracking behind current env-based contract.
2. Update docs (`architecture/agents.md`, hook env references, CLI reference).
3. Announce as temporary OpenCode path pending native `OPENCODE_SESSION_ID`.

## Addendum: Final State Once OpenCode Exposes `OPENCODE_SESSION_ID`

When OpenCode provides `OPENCODE_SESSION_ID` by default for shell execution:

1. Remove mandatory plugin bridge requirement for OpenCode.
2. Update resolver precedence to:
   - explicit `--session-id`
   - `PSTDIO_SESSION_ID`
   - `OPENCODE_SESSION_ID`
3. Keep bridge plugin as optional backward-compatible path for one transition window.
4. After migration window, deprecate and remove pstdio-managed OpenCode session-bridge installation.

This keeps the CLI contract stable while eliminating custom plugin plumbing once upstream support is complete.
