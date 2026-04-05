# Lifecycle Hooks

Hooks run during worktree, session, and ticket lifecycle events. All hooks are SDK plugins (`definePlugin`) in `.pstdio/plugins/`.

For the full hook contract (interface, payload schemas, attempt status, and cookbook), see [Hooks Reference](../hooks/index.md).

## Supported Hook Names

### Worktree hooks

- `preWorktreeCreate`
- `postWorktreeCreate`
- `preCommit`
- `postCommit`
- `preRebase`
- `postRebase`
- `preMerge`
- `postMerge`
- `preWorktreeRemove`
- `postWorktreeRemove`
- `onConflict`

### Session hooks

- `postSessionStart`
- `postSessionSuccess`
- `postSessionFail`
- `postSessionResume`
- `postSessionAwaitInput`

### Ticket hooks

- `preTicketCreation`
- `postTicketCreation`
- `preTicketStatusChange`
- `postTicketStatusChange`
- `preTicketArchive`
- `postTicketArchive`
- `preTicketDeletion`
- `postTicketDeletion`

### Attempt status hooks

- `preAttemptStatusChange`
- `postAttemptStatusChange`

## Blocking Hooks

Pre-hooks can reject the parent operation by returning `{ reject: true }`:

- `preWorktreeCreate`
- `preCommit`
- `preRebase`
- `preMerge`
- `preWorktreeRemove`
- `preTicketCreation`
- `preTicketStatusChange`
- `preTicketArchive`
- `preTicketDeletion`
- `preAttemptStatusChange`

All post-hooks and `onConflict` are non-blocking.

## Context Objects

Plugin hooks receive typed context objects. Each hook type has its own context shape defined in `@pstdio/sdk/plugins` (`PluginHooks`).

Common context fields by hook category:

| Field           | Description                    | Available In                          |
| --------------- | ------------------------------ | ------------------------------------- |
| `repoPath`      | Absolute path to main repo     | Worktree hooks                        |
| `worktreePath`  | Absolute path to worktree      | Worktree hooks                        |
| `branch`        | Worktree branch name           | Worktree hooks                        |
| `workspace`     | Workspace shorthand            | Worktree hooks                        |
| `ticket`        | Ticket shorthand               | Worktree hooks                        |
| `target`        | Target branch for merge/rebase | merge and rebase hooks                |
| `commitSha`     | Commit SHA                     | commit hooks                          |
| `commitMessage` | Commit message                 | commit hooks                          |
| `projectId`     | Project ID                     | Ticket, session, attempt status hooks |
| `fromStatus`    | Previous status                | Status change hooks                   |
| `toStatus`      | New status                     | Status change hooks                   |
| `client`        | SDK client for API calls       | All hooks fired via API               |

## CLI Commands

### `pstdio hooks list`

Show all supported hooks and whether each one has a matching plugin.

### `pstdio hooks create <hook-name>`

Create `.pstdio/plugins/<hook-name>`.

- Reuses the bundled scaffold when one exists, such as `postWorktreeCreate`
- Otherwise writes a minimal plugin starter
- Fails instead of overwriting an existing hook file

### `pstdio hooks run <hook-name>`

Manually run a hook. Useful for testing hooks before they fire automatically.

Options:

- `--worktree-path` — Override the worktree path (defaults to cwd)

## Cookbook

### Install dependencies on workspace creation

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
- **Discovery**: plugins are resolved from the filesystem at execution time
- **Runtime**: TypeScript/JavaScript modules loaded via `import()`
