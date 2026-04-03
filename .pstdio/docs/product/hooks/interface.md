# Interface and Environment

## Hook Script Location

Hooks are scripts stored at:

- `.pstdio/hooks/<hook-name>`

## Input and Output Contract

All hooks follow the same stdin/stdout JSON pipe interface.

- **Stdin**: event payload as JSON
- **Stdout**: optional output
- **Stderr**: error output shown to the user on failure
- **Exit code 0**: accept
- **Exit code non-zero**: reject for blocking hooks; non-blocking hooks log and continue

### Payload Override Marker

Payload overrides must be emitted with an explicit marker:

- `PSTDIO_PAYLOAD=<json-object>`

Rules:

- Plain JSON emitted by tools does not count as an override.
- Any stdout line without `PSTDIO_PAYLOAD=` is treated as log output.

```sh
# accept as-is
cat

# modify payload
NEXT=$(jq '.priority = "medium"')
echo "PSTDIO_PAYLOAD=$NEXT"

# logs + explicit override
echo "Hook checks passed"
NEXT=$(jq '. + {"notified": true}')
echo "PSTDIO_PAYLOAD=$NEXT"

# reject
echo "Missing description" >&2
exit 1
```

## Payload Modification Semantics

- `pre-*` hooks: payload modifications are applied before the operation executes.
- `post-*` hooks: payload modifications are accepted for interface consistency, but do not alter the already-completed operation.

Each hook invocation is independent.

## Environment Variable Rules

Hook env vars are payload-driven.

- `PSTDIO_HOOK` is always set to the hook name.
- Payloads are flat JSON objects.
- A payload field is surfaced as `PSTDIO_<UPPER_SNAKE_CASE_FIELD_NAME>`.
- Array values are exposed as JSON strings (single env var).
- Missing payload fields mean missing env vars.

Example mapping (`pre-worktree-create`):

| Payload field    | Env var                 |
| ---------------- | ----------------------- |
| `repo_path`      | `PSTDIO_REPO_PATH`      |
| `worktree_path`  | `PSTDIO_WORKTREE_PATH`  |
| `branch`         | `PSTDIO_BRANCH`         |
| `workspace`      | `PSTDIO_WORKSPACE`      |
| `ticket`         | `PSTDIO_TICKET`         |
| `attempt_status` | `PSTDIO_ATTEMPT_STATUS` |
| `base`           | `PSTDIO_BASE`           |

Array example:

| Payload field | Env var           | Value format |
| ------------- | ----------------- | ------------ |
| `file_ids`    | `PSTDIO_FILE_IDS` | JSON string  |

## Workspace Selector Note

When using session commands that take `--workspace-id`, the value may be either:

- workspace shorthand (for example `PS-1_A1`)
- workspace ID

## Session Correlation Note (attempt status)

`PSTDIO_SESSION_ID` is the correlation key used for session-bound attempt-status post hooks.
It only matters when a status change was triggered from an agent session and we need to map the change back to that session.

User-triggered `pstdio workspaces set-status` calls can omit `--session-id`; the workspace status still updates.

Post-hook delivery rules:

1. With `session_id`: post hook delivery is deferred to session termination.
2. Without `session_id`: post hook runs immediately after the status update is committed.

In concurrent workflows, do not rely on workspace context alone to infer session ownership. When possible, pass the session id explicitly:

```sh
pstdio workspaces set-status --workspace "$PSTDIO_WORKSPACE" --status review-ready --session-id "$PSTDIO_SESSION_ID"
```

Provider caveat:

- Claude Code can reliably provide `PSTDIO_SESSION_ID` via per-session process env.
- OpenCode should use a `shell.env` plugin bridge. The bridge reads OpenCode's optional `sessionID` / `callID`, resolves the matching pstdio session, and exports `PSTDIO_SESSION_ID` before shell execution.
