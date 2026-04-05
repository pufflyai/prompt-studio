# Cookbook

Use SDK plugins (`definePlugin`) for all lifecycle automation. Plugins in `.pstdio/plugins/` are the only hook mechanism.

For SDK plugin files under `.pstdio/plugins`, plugin identity comes from file path. Use one default-exported plugin per file and do not set an explicit plugin `key`.

## Shared Helpers

Use SDK helpers from `@pstdio/sdk/plugins`:

```ts
import {
  findTicketByRef,
  removeAllWorkspacesForTicket,
  setTicketStatus,
  setWorkspaceAttemptStatus,
  updateTicketWhenAllAttemptsMatch,
} from "@pstdio/sdk/plugins";
```

## Set Up a Worktree for Development

`postWorktreeCreate` — copy config, agent folders, env files, then install and build.

```ts
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { definePlugin } from "@pstdio/sdk/plugins";

const run = async (cwd: string, command: string[]) => {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  return (await proc.exited) === 0;
};

export default definePlugin({
  hooks: {
    async postWorktreeCreate(ctx) {
      const repoConfig = join(ctx.repoPath, ".pstdio", "config.json");
      const worktreeConfigDir = join(ctx.worktreePath, ".pstdio");
      const worktreeConfig = join(worktreeConfigDir, "config.json");

      if (existsSync(repoConfig)) {
        mkdirSync(worktreeConfigDir, { recursive: true });
        cpSync(repoConfig, worktreeConfig);
      }

      for (const agentDir of [".claude", ".opencode"]) {
        const fromDir = join(ctx.repoPath, agentDir);
        const toDir = join(ctx.worktreePath, agentDir);
        if (!existsSync(fromDir)) continue;
        mkdirSync(toDir, { recursive: true });
        cpSync(fromDir, toDir, { recursive: true });
      }

      for (const envFile of [".env", ".env.local", ".env.test"]) {
        const fromFile = join(ctx.repoPath, envFile);
        const toFile = join(ctx.worktreePath, envFile);
        if (!existsSync(fromFile)) continue;
        cpSync(fromFile, toFile);
      }

      if (!(await run(ctx.worktreePath, ["bun", "install"]))) return;
      await run(ctx.worktreePath, ["bun", "run", "build"]);
    },
  },
});
```

## Validate Before Committing / Before Merging

`preCommit` and `preMerge` are git-level hooks dispatched via plugins:

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

## Auto-Assign Default Fields on Ticket Creation

Use `postTicketCreation` to normalize status/tags after persistence.

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketCreation(ctx) {
      if (ctx.parentId) return;

      const backlogStatusId = await findStatusId(ctx, "backlog");
      const tags = await ctx.client.tags.list(ctx.projectId);
      const triageTagOptionId = tags
        .find((tag) => tag.name === "workflow")
        ?.options.find((option) => option.name === "needs-triage")?.id;

      const tagIds =
        triageTagOptionId && !ctx.tagIds.includes(triageTagOptionId)
          ? [...ctx.tagIds, triageTagOptionId]
          : ctx.tagIds;

      if (!backlogStatusId && tagIds.length === ctx.tagIds.length) return;

      await ctx.client.tickets.update(ctx.id, {
        status_id: backlogStatusId,
        tag_ids: tagIds,
      });
    },
  },
});
```

## Branch on Completion Status

Use `postAttemptStatusChange` instead of branching inside `post-session-success`.

```ts
import { definePlugin, setTicketStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postAttemptStatusChange(ctx) {
      if (ctx.toStatus === "blocked" && ctx.ticket) {
        await setTicketStatus(ctx, {
          ticket: ctx.ticket.shorthand,
          status: "blocked",
        });
      }

      if (ctx.toStatus === "review-ready" && ctx.ticket) {
        await ctx.client.sessions.create({
          project_id: ctx.projectId,
          workspace_id: ctx.workspace.id,
          title: `Code review: ${ctx.ticket.shorthand}`,
          prompt:
            "Run a code review for this workspace and summarize actionable findings.",
          agent: "reviewer",
        });
      }
    },
  },
});
```

## Move Ticket to WIP When Work Starts

`postSessionStart` — move ticket to `wip` when a workspace session starts.

```ts
import {
  definePlugin,
  findTicketByRef,
  setTicketStatus,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;
      const ticket = await findTicketByRef(ctx, {
        ticketId: ctx.ticket.shorthand,
      });
      if (!ticket) return;
      if (ticket.status_name === "review" || ticket.status_name === "wip")
        return;

      await setTicketStatus(ctx, {
        ticket: ticket.id,
        status: "wip",
      });
    },
  },
});
```

## Notify on Ticket Status Change

`postTicketStatusChange` — send a Slack message when a ticket changes status.

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketStatusChange(ctx) {
      if (!ctx.toStatus || !process.env.SLACK_WEBHOOK) return;
      await fetch(process.env.SLACK_WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: `Ticket ${ctx.shorthand} moved to ${ctx.toStatus}`,
        }),
      });
    },
  },
});
```

## Cleanup Worktrees on Archive

`postTicketArchive` — remove worktrees associated with the archived ticket.

```ts
import {
  definePlugin,
  removeAllWorkspacesForTicket,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketArchive(ctx) {
      await removeAllWorkspacesForTicket(ctx, { ticketId: ctx.id });
    },
  },
});
```

## Add a Manual Action Trigger

Use plugin actions when the user should click a button instead of waiting for a lifecycle hook.

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      async trigger(ctx) {
        await ctx.client.sessions.create({
          project_id: ctx.projectId,
          workspace_id: ctx.targetId,
          title: "Manual review",
          prompt:
            "Review this workspace for correctness, regressions, and missing tests.",
          agent: "reviewer",
        });
      },
    },
  ],
});
```
