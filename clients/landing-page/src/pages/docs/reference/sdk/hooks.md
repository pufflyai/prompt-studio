---
layout: ../../../../layouts/docs-layout.astro
title: Hook reference
description: Every hook name, when it fires, and the fields available on its context.
htmlTitle: SDK hooks reference
htmlDescription: Every Prompt Studio plugin hook, when it fires, and the fields available on its context.
section: References
category: SDK
categoryOrder: 2
order: 3
---

## Return types

- **Pre-hooks** — return `undefined` to allow, or `{ reject: true, reason?: string, data?: Record<string, unknown> }` to block. Async `Promise<...>` is accepted.
- **Post-hooks** — return `void` or `Promise<void>`.

All hooks receive a context containing `client: HookClient` (a scoped SDK client) and `projectId: string` in addition to the event-specific fields below.

## Ticket hooks

### preTicketCreation — `TicketCreationContext`

Fires before a ticket is created.

Fields: `id: null`, `shorthand: null`, `displayTitle`, `userPrompt`, `parentId`, `draft`, `archived`, `status`, `tagIds[]`, `tagNames[]`, `fileIds[]`, `content`.

### postTicketCreation — `TicketContext`

Fires after a ticket is created.

Fields: `id`, `shorthand`, `displayTitle`, `userPrompt`, `parentId`, `draft`, `archived`, `status`, `tagIds[]`, `tagNames[]`, `fileIds[]`.

### preTicketStatusChange / postTicketStatusChange — `TicketStatusChangeContext`

Fires before/after a ticket's status changes.

Fields: same as `TicketContext` plus `fromStatus: string | null`, `toStatus: string | null`.

### preTicketArchive / postTicketArchive — `TicketContext`

Fires before/after a ticket is archived.

### preTicketDeletion / postTicketDeletion — `TicketContext`

Fires before/after a ticket is deleted.

## Session hooks

### postSessionStart — `SessionHookContext`

Fires after a session is started.

Fields: `sessionId`, `sessionStatus`, `originalSessionId?`, `workspace?`, `workspaceId?`, `worktreePath?`, `branch?`, `ticket?`, `attemptStatus?`.

### postSessionSuccess — `SessionHookContext`

Fires when a session completes successfully.

### postSessionFail — `SessionHookContext`

Fires when a session fails.

### postSessionResume — `SessionHookContext`

Fires when a session is resumed (follow-up).

### postSessionAwaitInput — `SessionHookContext`

Fires when a session enters `awaiting_input` (for example, tool approval).

## Worktree hooks

### preWorktreeCreate — `WorktreeCreateContext`

Fires before a worktree is created.

Fields: `repoPath`, `worktreePath`, `branch`, `workspace`, `ticket`, `base`.

### postWorktreeCreate — `WorktreeContext`

Fires after a worktree is created.

Fields: `repoPath`, `worktreePath`, `branch`, `workspace`, `workspaceId`, `ticket`.

### preWorktreeRemove / postWorktreeRemove — `WorktreeRemoveContext`

Fires before/after a worktree is removed.

Fields: `repoPath`, `worktreePath: string | null`, `branch`, `workspace`, `workspaceId`, `ticket: string | null`.

## Git operation hooks

### preCommit / postCommit — `CommitContext`

Fires before/after a commit.

Fields: `repoPath`, `worktreePath`, `commitMessage`, `stagePolicy`, `commitSha?`.

### preRebase / postRebase — `RebaseContext`

Fires before/after a rebase.

Fields: `repoPath`, `branch`, `target`.

### preMerge / postMerge — `MergeContext`

Fires before/after a merge.

Fields: `repoPath`, `branch`, `target`, `squash: boolean`, `commitMessage: string | null`, `commitSha?`.

### onConflict — `ConflictContext`

Fires when a merge or rebase conflict is detected.

Fields: `repoPath`, `branch`, `target`, `operation: "rebase" | "merge"`.

## Attempt status hooks

### preAttemptStatusChange / postAttemptStatusChange — `AttemptStatusChangeContext`

Fires before/after an attempt's status changes.

Fields: `workspace`, `workspaceId`, `prompts`, `ticket?`, `worktreePath?`, `branch?`, `fromStatus`, `toStatus`, `sessionId?`, `originalSessionId?`.

## Example

```ts
import { definePlugin } from "@pstdio/sdk/plugins";
import { runCommand } from "@pstdio/sdk/plugins/helpers";

export default definePlugin({
  key: "guardrails",
  hooks: {
    preAttemptStatusChange: async (ctx) => {
      if (ctx.toStatus !== "review-ready" || !ctx.worktreePath) return;

      const { exitCode } = await runCommand(ctx.worktreePath, ["bun", "run", "validate"], { quiet: true });
      if (exitCode !== 0) {
        return { reject: true, reason: "`bun run validate` failed." };
      }
    },
  },
});
```

## Related pages

- [Use hooks](/docs/automation/hooks/).
- [SDK plugins](/docs/reference/sdk/plugins/) — `definePlugin` shape.
