# Hook Reference

This reference covers SDK plugin hook names available in `definePlugin({ hooks: ... })`.

## Pre Hooks (can block)

Return `{ reject: true, reason: "..." }` to abort the parent operation.

- `preTicketCreation(ctx)`
- `preTicketStatusChange(ctx)`
- `preTicketArchive(ctx)`
- `preTicketDeletion(ctx)`
- `preWorktreeCreate(ctx)`
- `preWorktreeRemove(ctx)`
- `preCommit(ctx)`
- `preRebase(ctx)`
- `preMerge(ctx)`
- `preAttemptStatusChange(ctx)`

## Post Hooks (side effects)

These run after the operation; errors are logged and isolated.

- `postTicketCreation(ctx)`
- `postTicketStatusChange(ctx)`
- `postTicketArchive(ctx)`
- `postTicketDeletion(ctx)`
- `postSessionStart(ctx)`
- `postSessionSuccess(ctx)`
- `postSessionFail(ctx)`
- `postSessionResume(ctx)`
- `postSessionAwaitInput(ctx)`
- `postWorktreeCreate(ctx)`
- `postWorktreeRemove(ctx)`
- `postCommit(ctx)`
- `postRebase(ctx)`
- `postMerge(ctx)`
- `onConflict(ctx)`
- `postAttemptStatusChange(ctx)`

## Hook Context Families

Context object shape depends on hook family:

- Ticket: creation, status transitions, archive, deletion
- Worktree: create/remove, commit/rebase/merge/conflict
- Session: start/success/fail/resume/await-input
- Attempt status: transitions (for example `wip -> review-ready`)

Use TypeScript inference from `definePlugin` + SDK exports to inspect exact fields in your editor.

## Shell Hook Commands

For git-level shell hooks, use:

- `pstdio hooks list`
- `pstdio hooks create <hook-name>`
- `pstdio hooks run <hook-name> [--worktree-path <path>]`
