# Lifecycle Hooks

Hooks are shell scripts in `.pstdio/hooks/<hook-name>` that run during worktree, session, and ticket lifecycle events.

For the full hook contract (interface, payload schemas, attempt status, and cookbook), see [Hooks Reference](../hooks/index.md).

## Supported Hook Names

### Worktree hooks

- `pre-worktree-create`
- `post-worktree-create`
- `pre-commit`
- `post-commit`
- `pre-rebase`
- `post-rebase`
- `pre-merge`
- `post-merge`
- `pre-worktree-remove`
- `post-worktree-remove`
- `on-conflict`

### Session hooks

- `post-session-start`
- `post-session-success`
- `post-session-fail`
- `post-session-resume`
- `post-session-await-input`

### Ticket hooks

- `pre-ticket-creation`
- `post-ticket-creation`
- `pre-ticket-status-change`
- `post-ticket-status-change`
- `pre-ticket-archive`
- `post-ticket-archive`
- `pre-ticket-deletion`
- `post-ticket-deletion`

## Blocking Hooks

Non-zero exit codes abort the parent operation for:

- `pre-worktree-create`
- `post-worktree-create`
- `pre-commit`
- `pre-rebase`
- `pre-merge`
- `pre-worktree-remove`
- `pre-ticket-creation`
- `pre-ticket-status-change`
- `pre-ticket-archive`
- `pre-ticket-deletion`

All other hooks are non-blocking.

## Environment Variables

All hooks receive context as environment variables:

| Variable                | Description                    | Available In                  |
| ----------------------- | ------------------------------ | ----------------------------- |
| `PSTDIO_HOOK`           | Hook name (e.g. `pre-merge`)   | All                           |
| `PSTDIO_BRANCH`         | Worktree branch name           | All                           |
| `PSTDIO_WORKTREE_PATH`  | Absolute path to worktree      | All (except `pre-create`)     |
| `PSTDIO_REPO_PATH`      | Absolute path to main repo     | All                           |
| `PSTDIO_WORKSPACE`      | Workspace shorthand            | All                           |
| `PSTDIO_TICKET`         | Ticket shorthand               | When ticket context exists    |
| `PSTDIO_ATTEMPT_STATUS` | Attempt status                 | When workspace context exists |
| `PSTDIO_FROM_STATUS`    | Previous status                | Ticket status change hooks    |
| `PSTDIO_TO_STATUS`      | New status                     | Ticket status change hooks    |
| `PSTDIO_TARGET`         | Target branch for merge/rebase | merge and rebase hooks        |
| `PSTDIO_COMMIT_SHA`     | Commit SHA after commit/merge  | `post-commit`, `post-merge`   |
| `PSTDIO_COMMIT_MESSAGE` | Commit message                 | `pre-commit`, `post-commit`   |

## CLI Commands

### `pstdio hooks list`

Show all supported hooks and whether each script file exists.

### `pstdio hooks create <hook-name>`

Create `.pstdio/hooks/<hook-name>`.

- Reuses the bundled scaffold when one exists, such as `post-worktree-create`
- Otherwise writes a minimal shell-script starter
- Fails instead of overwriting an existing hook file

### `pstdio hooks run <hook-name>`

Manually run a hook script. Useful for testing hooks before they fire automatically.

Options:

- `--worktree-path` — Override the worktree path (defaults to cwd)

## Cookbook

### Install dependencies on workspace creation

```sh
# .pstdio/hooks/post-worktree-create
bun install
```

### Copy `.env` files into new worktrees

```sh
# .pstdio/hooks/post-worktree-create
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

## Storage & Configuration

- **Source of truth**: filesystem at `.pstdio/hooks/<hook-name>`
- **Discovery**: hooks are resolved from the filesystem at execution time
- **Execution**: `sh <script-path>` — executable permissions are optional
- **Timeout**: 60 seconds — hooks that exceed this limit are killed
