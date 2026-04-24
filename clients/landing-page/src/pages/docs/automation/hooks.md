---
layout: ../../../layouts/docs-layout.astro
title: Use hooks
description: React to ticket, session, and worktree lifecycle events from your plugins.
htmlTitle: Use plugin hooks
htmlDescription: React to ticket, session, worktree, and git lifecycle events from Prompt Studio plugins.
section: Guide
category: Automation
categoryOrder: 5
order: 4
---

## Hook shape

Hooks are functions exported on a plugin's `hooks` field. Every hook receives a context object describing the event, plus an SDK `client` scoped to the project. Hooks come in two flavors:

- **Pre-hooks** may reject the operation:
  ```ts
  return { reject: true, reason: "status must be review-ready first" };
  ```
  They can also return `{ data: {...} }` to mutate payloads (where supported). Returning `undefined` allows the operation.
- **Post-hooks** return `void` — they react, they don't veto.

## A tiny example

```ts
// .pstdio/plugins/guardrails.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  key: "guardrails",
  hooks: {
    preTicketStatusChange: async (ctx) => {
      if (ctx.toStatus === "done" && !ctx.tagNames.includes("reviewed")) {
        return { reject: true, reason: "Ticket must have the `reviewed` tag to be marked done." };
      }
    },
    postMerge: async (ctx) => {
      console.log(`Merged ${ctx.branch} into ${ctx.target} (${ctx.commitSha ?? "?"})`);
    },
  },
});
```

Register the file:

```bash
pstdio plugins register
```

## Hook categories

### Ticket hooks

`preTicketCreation`, `postTicketCreation`, `preTicketStatusChange`, `postTicketStatusChange`, `preTicketArchive`, `postTicketArchive`, `preTicketDeletion`, `postTicketDeletion`.

### Session hooks

`postSessionStart`, `postSessionSuccess`, `postSessionFail`, `postSessionResume`, `postSessionAwaitInput`.

### Worktree hooks

`preWorktreeCreate`, `postWorktreeCreate`, `preWorktreeRemove`, `postWorktreeRemove`.

### Git operation hooks

`preCommit`, `postCommit`, `preRebase`, `postRebase`, `preMerge`, `postMerge`, `onConflict`.

### Attempt status hooks

`preAttemptStatusChange`, `postAttemptStatusChange`.

See [Hook reference](/docs/reference/sdk/hooks/) for each hook's context type and fields.

## Common patterns

### Require green validation before marking review-ready

```ts
preAttemptStatusChange: async (ctx) => {
  if (ctx.toStatus !== "review-ready") return;

  const { exitCode } = await runCommand(ctx.worktreePath!, ["bun", "run", "validate"], { quiet: true });
  if (exitCode !== 0) {
    return { reject: true, reason: "`bun run validate` failed in the worktree." };
  }
},
```

### Post a summary when a session completes

```ts
postSessionSuccess: async (ctx) => {
  await ctx.client.sessions.followUp(ctx.sessionId, {
    content: "Summarize what changed in the workspace diff.",
  });
},
```

### Bootstrap a new worktree

```ts
postWorktreeCreate: async (ctx) => {
  await bootstrapWorktree(ctx, {
    repoPath: ctx.repoPath,
    worktreePath: ctx.worktreePath,
    ticketId: ctx.ticket,
  });
},
```

## Related pages

- [Hook reference](/docs/reference/sdk/hooks/).
- [`definePlugin` reference](/docs/reference/sdk/plugins/).
- [Plugin helpers](/docs/reference/sdk/plugins/#plugin-helpers) — `runCommand`, `saveTicket`, `createAttempt`, etc.
