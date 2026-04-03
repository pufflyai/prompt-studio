# Hook Environment Variables

All hooks receive context as environment variables. Not all variables are available in every hook — guard with `[ -n "$VAR" ]` before using.

## Always Available

| Variable            | Description                  |
| ------------------- | ---------------------------- |
| `PSTDIO_HOOK`       | Hook name (e.g. `pre-merge`) |
| `PSTDIO_BRANCH`     | Worktree branch name         |
| `PSTDIO_REPO_PATH`  | Absolute path to main repo   |
| `PSTDIO_PROJECT_ID` | Project ID                   |

## Conditionally Available

| Variable                     | Description                      | Available In                        |
| ---------------------------- | -------------------------------- | ----------------------------------- |
| `PSTDIO_WORKTREE_PATH`       | Absolute path to worktree        | All except `pre-worktree-create`    |
| `PSTDIO_WORKSPACE`           | Workspace shorthand              | When workspace context exists       |
| `PSTDIO_TICKET`              | Ticket shorthand                 | When ticket context exists          |
| `PSTDIO_ATTEMPT_STATUS`      | Current attempt status           | When workspace context exists       |
| `PSTDIO_SESSION_ID`          | Current session ID               | Session hooks, attempt-status hooks |
| `PSTDIO_ORIGINAL_SESSION_ID` | Original session ID (follow-ups) | Session hooks                       |
| `PSTDIO_WORKSPACE_ID`        | Workspace ID                     | Session hooks, attempt-status hooks |

### Session ID Reliability Note

`PSTDIO_SESSION_ID` should be treated as best-effort context, not guaranteed context in all provider paths.

- Claude Code flows can reliably inject `PSTDIO_SESSION_ID` per spawned/resumed process.
- OpenCode uses a shared server model, so per-session env is not always a reliable channel.

When running attempt-status automation, prefer explicit correlation:

```sh
pstdio workspaces set-status --workspace "$PSTDIO_WORKSPACE" --status review-ready --session-id "$PSTDIO_SESSION_ID"
```

## Hook-Specific Variables

| Variable                     | Description             | Available In                                            |
| ---------------------------- | ----------------------- | ------------------------------------------------------- |
| `PSTDIO_TARGET`              | Target branch           | `pre-merge`, `post-merge`, `pre-rebase`, `post-rebase`  |
| `PSTDIO_COMMIT_SHA`          | Commit SHA              | `post-commit`, `post-merge`                             |
| `PSTDIO_COMMIT_MESSAGE`      | Commit message          | `pre-commit`, `post-commit`                             |
| `PSTDIO_FROM_STATUS`         | Previous ticket status  | `pre-ticket-status-change`, `post-ticket-status-change` |
| `PSTDIO_TO_STATUS`           | New ticket status       | `pre-ticket-status-change`, `post-ticket-status-change` |
| `PSTDIO_ATTEMPT_STATUS_FROM` | Previous attempt status | `pre-attempt-status-*`, `post-attempt-status-*`         |
| `PSTDIO_ATTEMPT_STATUS_TO`   | New attempt status      | `pre-attempt-status-*`, `post-attempt-status-*`         |

## Stdin Payload

In addition to environment variables, hooks receive a JSON payload on stdin containing the same fields. Read it when you need structured data:

```sh
PAYLOAD=$(cat)
BRANCH=$(echo "$PAYLOAD" | jq -r '.branch')
```

## Payload Override

A hook can modify the downstream payload by printing a special line as its **last stdout output**:

```sh
echo "PSTDIO_PAYLOAD={\"custom_field\":\"value\"}"
```

This is advanced usage — most hooks do not need it.
