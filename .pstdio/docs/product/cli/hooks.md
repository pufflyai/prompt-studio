# Lifecycle Hooks

Hooks run during worktree, session, and ticket lifecycle events. All hooks are SDK plugins (`definePlugin`) in `.pstdio/plugins/`.

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

Plugin hooks receive context as environment variables:

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

Show all supported hooks and whether each one exists.

### `pstdio hooks create <hook-name>`

Create `.pstdio/plugins/<hook-name>`.

- Reuses the bundled scaffold when one exists, such as `post-worktree-create`
- Otherwise writes a minimal plugin starter
- Fails instead of overwriting an existing hook file

### `pstdio hooks run <hook-name>`

Manually run a hook. Useful for testing hooks before they fire automatically.

Options:

- `--worktree-path` — Override the worktree path (defaults to cwd)

## Cookbook

### Install dependencies on workspace creation

Use a plugin for worktree setup:

```ts
// .pstdio/plugins/worktree-bootstrap.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postWorktreeCreate(ctx) {
      const proc = Bun.spawn(["bun", "install"], {
        cwd: ctx.worktreePath,
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    },
  },
});
```

### Run validation before committing

```ts
// .pstdio/plugins/pre-commit.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preCommit(ctx) {
      const proc = Bun.spawn(["bun", "run", "validate"], {
        cwd: ctx.worktreePath,
        stdout: "inherit",
        stderr: "inherit",
      });
      const code = await proc.exited;
      if (code !== 0) throw new Error("Validation failed");
    },
  },
});
```

### Run tests before merging

```ts
// .pstdio/plugins/pre-merge.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preMerge(ctx) {
      const proc = Bun.spawn(["bun", "run", "test"], {
        cwd: ctx.worktreePath,
        stdout: "inherit",
        stderr: "inherit",
      });
      const code = await proc.exited;
      if (code !== 0) throw new Error("Tests failed");
    },
  },
});
```

## Storage & Configuration

- **Source of truth**: filesystem at `.pstdio/plugins/`
- **Discovery**: hooks are resolved from the filesystem at execution time
- **Plugin hooks**: TypeScript/JavaScript modules loaded via `import()`
- **Timeout**: 60 seconds — hooks that exceed this limit are killed
