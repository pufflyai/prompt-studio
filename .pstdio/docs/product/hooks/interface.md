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
