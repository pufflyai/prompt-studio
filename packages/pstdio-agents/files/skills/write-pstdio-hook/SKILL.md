---
name: write-pstdio-hook
description: "Create or edit a pstdio lifecycle hook. Use when asked to write, add, or modify a hook."
metadata:
  - version: 0.0.1
---

## Workflow

1. Run `pstdio hooks list` to see available hook names and which ones already exist.
2. Decide which hook to use based on the user's goal:
   - **Worktree hooks** — setup, teardown, commit/merge/rebase gates
   - **Session hooks** — react to agent session lifecycle (start, success, fail, resume, await-input)
   - **Ticket hooks** — react to ticket creation, status changes, archival, deletion
3. For lifecycle hooks (session, ticket, worktree-create, attempt-status), create or extend an SDK plugin in `.pstdio/plugins/`. For git-level hooks (commit, merge, rebase, conflict, worktree-remove), use `pstdio hooks create <hook-name>` to scaffold a shell script in `.pstdio/plugins/`, or create one manually.
4. Write lifecycle hooks as TypeScript/JavaScript plugins using `definePlugin` from `@pstdio/sdk/plugins`. Write git-level hooks as POSIX shell scripts (`#!/bin/sh`).
5. Decide blocking behavior:
   - **Blocking hooks** (`pre-*` and `post-worktree-create`): return `{ reject: true, reason: "..." }` from plugins, or `exit 1` from shell scripts, to abort the parent operation.
   - **Non-blocking hooks** (all other `post-*`, session hooks): exceptions are caught and logged. These are for side-effects only.
6. Test shell hooks manually with `pstdio hooks run <hook-name> [--worktree-path <path>]`.
7. If the hook modifies bundled scaffolds in `packages/pstdio/files/plugins/`, update the packaged smoke-test expectations.

## Key Rules

- Hooks are stored in `.pstdio/plugins/`.
- Lifecycle hooks are TypeScript/JavaScript modules with a `default` export using `definePlugin`.
- Git-level hooks (commit, merge, rebase, conflict, worktree-remove) are shell scripts that **must be executable** (`chmod +x`). `pstdio hooks create` sets this automatically.
- Shell hooks are executed with `sh <script-path>`, so keep them POSIX-compatible.
- Hooks time out after 60 seconds — keep them fast or background long-running work.
- `pstdio hooks create` fails if the file already exists — edit the existing file instead.
- Shell hooks can override the downstream payload by printing `PSTDIO_PAYLOAD=<json>` as the last stdout line.
- Guard on available variables — not all env vars are set in every shell hook (e.g. `PSTDIO_WORKTREE_PATH` is absent in `pre-worktree-create`).

## Cheatsheet

### List hooks

```bash
pstdio hooks list
```

### Create a shell hook

```bash
pstdio hooks create <hook-name>
```

### Test a shell hook

```bash
pstdio hooks run <hook-name> [--worktree-path <path>]
```

## References

- [references/environment-variables.md](references/environment-variables.md) — All environment variables available in shell hooks.
- [references/examples.md](references/examples.md) — Complete hook examples covering common use cases.
