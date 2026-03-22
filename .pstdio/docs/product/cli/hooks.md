# Lifecycle Hooks

Hooks are shell scripts in `.pstdio/hooks/<hook-name>` that run automatically during worktree lifecycle events. They replace the legacy `startup_script` system.

## Hook Reference

| Hook                      | Event                                       | Blocking | Typical Use                              |
| ------------------------- | ------------------------------------------- | -------- | ---------------------------------------- |
| `pre-create`              | Before worktree is created                  | Yes      | Validate branch name, check disk space   |
| `post-create`             | After worktree is created and config copied | No       | Install deps, generate config, seed data |
| `pre-commit`              | Before staging and committing changes       | Yes      | Lint, format, type-check                 |
| `post-commit`             | After a commit is created                   | No       | Notifications, trigger CI                |
| `pre-rebase`              | Before rebasing worktree onto target        | Yes      | Run tests, check for WIP commits         |
| `post-rebase`             | After successful rebase                     | No       | Reinstall deps if lockfile changed       |
| `pre-merge`               | Before squash-merging worktree              | Yes      | Run full test suite, build               |
| `post-merge`              | After successful merge                      | No       | Deploy, tag release, notify team         |
| `pre-remove`              | Before worktree deletion                    | Yes      | Archive artifacts, check unpushed work   |
| `post-remove`             | After worktree is removed                   | No       | Kill dev servers, clean caches           |
| `on-conflict`             | When a merge or rebase hits conflicts       | No       | Notify user, log conflict details        |
| `on-ticket-status-change` | When a ticket status changes                | No       | Notifications, status sync               |
| `on-ticket-archive`       | When a ticket is archived/unarchived        | No       | Archive automation, audits               |
| `on-ticket-delete`        | When a ticket is deleted                    | No       | Cleanup, external system sync            |
| `on-session-complete`     | When a session reaches a terminal status    | No       | Run tests, validate agent work           |

## Blocking Semantics

- **Blocking hooks** (`pre-*`): non-zero exit aborts the parent operation.
- **Non-blocking hooks** (`post-*`, `on-conflict`): failures are logged but do not affect the parent operation.

## Environment Variables

All hooks receive context as environment variables:

| Variable                    | Description                    | Available In                |
| --------------------------- | ------------------------------ | --------------------------- |
| `PSTDIO_HOOK`               | Hook name (e.g. `pre-merge`)   | All                         |
| `PSTDIO_BRANCH`             | Worktree branch name           | All                         |
| `PSTDIO_WORKTREE_PATH`      | Absolute path to worktree      | All (except `pre-create`)   |
| `PSTDIO_REPO_PATH`          | Absolute path to main repo     | All                         |
| `PSTDIO_WORKSPACE`          | Workspace shorthand            | All                         |
| `PSTDIO_TARGET`             | Target branch for merge/rebase | merge and rebase hooks      |
| `PSTDIO_COMMIT_SHA`         | Commit SHA after commit/merge  | `post-commit`, `post-merge` |
| `PSTDIO_COMMIT_MESSAGE`     | Commit message                 | `pre-commit`, `post-commit` |
| `PSTDIO_PROJECT_ID`         | Project ID                     | All                         |
| `PSTDIO_TICKET_ID`          | Ticket id                      | ticket hooks                |
| `PSTDIO_TICKET_SHORTHAND`   | Ticket shorthand               | ticket hooks                |
| `PSTDIO_TICKET_STATUS_OLD`  | Previous status id             | `on-ticket-status-change`   |
| `PSTDIO_TICKET_STATUS_NEW`  | New status id                  | `on-ticket-status-change`   |
| `PSTDIO_TICKET_ARCHIVED_AT` | Archive timestamp if archived  | `on-ticket-archive`         |
| `PSTDIO_TICKET_DELETED_AT`  | Deletion timestamp             | `on-ticket-delete`          |
| `PSTDIO_SESSION_ID`        | Session ID                       | `on-session-complete`       |
| `PSTDIO_SESSION_STATUS`    | Terminal status of the session   | `on-session-complete`       |

## CLI Commands

### `pstdio hooks list`

Show all supported hooks and whether each script file exists.

### `pstdio hooks run <hook-name>`

Manually run a hook script. Useful for testing hooks before they fire automatically.

Options:

- `--worktree-path` — Override the worktree path (defaults to cwd)

## Cookbook

### Install dependencies on workspace creation

```sh
# .pstdio/hooks/post-create
bun install
```

### Copy `.env` files into new worktrees

```sh
# .pstdio/hooks/post-create
for f in .env .env.local .env.test; do
  if [ -f "$PSTDIO_REPO_PATH/$f" ]; then
    cp "$PSTDIO_REPO_PATH/$f" "$PSTDIO_WORKTREE_PATH/$f"
  fi
done
```

### Run validation before committing

```sh
# .pstdio/hooks/pre-commit
bun run validate
```

### Run tests before merging

```sh
# .pstdio/hooks/pre-merge
bun run test
```

### Validate agent work and update ticket status

```sh
# .pstdio/hooks/on-session-complete
cd "$PSTDIO_WORKTREE_PATH"

output=$(bun run validate 2>&1)

if [ $? -eq 0 ]; then
  pstdio tickets update --id "$PSTDIO_TICKET_SHORTHAND" --status "review"
else
  pstdio sessions follow-up --id "$PSTDIO_SESSION_ID" \
    --prompt "Validation failed. Fix the issues and try again:\n$output"
fi
```

## Storage & Configuration

- **Source of truth**: filesystem at `.pstdio/hooks/<hook-name>`
- **Discovery**: hooks are resolved from the filesystem at execution time
- **Execution**: `sh <script-path>` — executable permissions are optional
- **Timeout**: 60 seconds — hooks that exceed this limit are killed
