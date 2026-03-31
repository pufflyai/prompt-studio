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
3. If the hook file does not exist, run `pstdio hooks create <hook-name>` to scaffold it. If it already exists, read and extend the existing file.
4. Write the hook as a POSIX shell script (`#!/bin/sh`). Use environment variables (see [references/environment-variables.md](references/environment-variables.md)) to access context. Read structured JSON from stdin only when the hook needs fields not available as env vars.
5. Decide blocking behavior:
   - **Blocking hooks** (`pre-*` and `post-worktree-create`): a non-zero exit code aborts the parent operation. Use `exit 1` to reject an action (e.g. fail a commit that doesn't pass validation).
   - **Non-blocking hooks** (all other `post-*`, session, and most ticket hooks): exit code is ignored. These are for side-effects only.
6. Test the hook manually with `pstdio hooks run <hook-name> [--worktree-path <path>]`.
7. If the hook modifies bundled scaffolds in `packages/pstdio/files/hooks/`, update the packaged smoke-test expectations.

## Key Rules

- Hooks are scripts at `.pstdio/hooks/<hook-name>`.
- Hook files **must be executable** (`chmod +x`). `pstdio hooks create` sets this automatically, but if you write or replace a hook file directly, ensure the executable bit is set.
- Hooks are executed with `sh <script-path>`, so keep them POSIX-compatible.
- Hooks time out after 60 seconds — keep them fast or background long-running work.
- `pstdio hooks create` fails if the file already exists — edit the existing file instead.
- A hook can override the downstream payload by printing `PSTDIO_PAYLOAD=<json>` as its last stdout line.
- Guard on available variables — not all env vars are set in every hook (e.g. `PSTDIO_WORKTREE_PATH` is absent in `pre-worktree-create`).

## Cheatsheet

### List hooks

```bash
pstdio hooks list
```

### Create a hook

```bash
pstdio hooks create <hook-name>
```

### Test a hook

```bash
pstdio hooks run <hook-name> [--worktree-path <path>]
```

## References

- [references/environment-variables.md](references/environment-variables.md) — All environment variables available in hooks.
- [references/examples.md](references/examples.md) — Complete hook examples covering common use cases.
