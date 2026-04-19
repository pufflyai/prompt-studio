# Plugin Examples

All examples live in `.pstdio/plugins/*.ts`. Filenames are arbitrary; `pstdio` registers hooks from the method names inside `hooks` and actions from the array entries inside `actions`. One plugin file can contribute hooks, actions, or both — group by concern.

The examples below are split into **Hooks** (reactive lifecycle callbacks) and **Actions** (user-triggered commands).

## Hooks

### Worktree Hooks

### Copy environment files into new worktrees

```ts
// .pstdio/plugins/worktree-env.ts
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    postWorktreeCreate(ctx) {
      for (const name of [".env", ".env.local", ".env.test"]) {
        const source = join(ctx.repoPath, name);
        const destination = join(ctx.worktreePath, name);
        if (existsSync(source)) {
          cpSync(source, destination);
        }
      }
    },
  },
});
```

### Bootstrap a full worktree and install dependencies

```ts
// .pstdio/plugins/worktree-lifecycle.ts
import { bootstrapWorktree, definePlugin, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postWorktreeCreate(ctx) {
      await bootstrapWorktree(ctx, {
        repoPath: ctx.repoPath,
        worktreePath: ctx.worktreePath,
        ticketId: ctx.ticket,
      });

      await runCommand(ctx.worktreePath, ["bun", "install"]);
      await runCommand(ctx.worktreePath, ["bun", "run", "build"]);
    },
  },
});
```

### Gate commits with validation

```ts
// .pstdio/plugins/pre-commit-guard.ts
import { definePlugin, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preCommit(ctx) {
      const validation = await runCommand(ctx.worktreePath, ["bun", "run", "validate"]);
      if (validation.exitCode === 0) return;

      const output = [validation.stdout, validation.stderr].filter(Boolean).join("\n\n");
      return {
        reject: true,
        reason: output || "bun run validate failed",
      };
    },
  },
});
```

### Run tests before merging

```ts
// .pstdio/plugins/pre-merge-guard.ts
import { definePlugin, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preMerge(ctx) {
      const testRun = await runCommand(ctx.repoPath, ["bun", "test"]);
      if (testRun.exitCode === 0) return;

      const output = [testRun.stdout, testRun.stderr].filter(Boolean).join("\n\n");
      return {
        reject: true,
        reason: output || "bun test failed",
      };
    },
  },
});
```

### Clean up caches before removing a worktree

```ts
// .pstdio/plugins/worktree-cleanup.ts
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    preWorktreeRemove(ctx) {
      if (!ctx.worktreePath) return;

      const nodeModules = join(ctx.worktreePath, "node_modules");
      if (existsSync(nodeModules)) {
        rmSync(nodeModules, { recursive: true, force: true });
      }
    },
  },
});
```

### Session Hooks

### Move the ticket to `wip` when a session starts

```ts
// .pstdio/plugins/ticket-lifecycle.ts
import { definePlugin, setTicketStatus, setWorkspaceAttemptStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;

      if (ctx.ticket.status_name !== "review") {
        await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
      }

      if (ctx.workspace && !ctx.workspace.attempt_status_name) {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          statusName: "wip",
          sessionId: ctx.sessionId,
        });
      }
    },
  },
});
```

### Mark the ticket as blocked when a session fails

```ts
// .pstdio/plugins/session-failure.ts
import { definePlugin, setTicketStatus, setWorkspaceAttemptStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionFail(ctx) {
      if (ctx.ticket) {
        await setTicketStatus(ctx, {
          ticket: ctx.ticket.shorthand,
          status: "blocked",
        });
      }

      if (ctx.workspace) {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          statusName: "blocked",
          sessionId: ctx.sessionId,
        });
      }
    },
  },
});
```

### Log sessions that are waiting for input

```ts
// .pstdio/plugins/session-await-input.ts
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    postSessionAwaitInput(ctx) {
      const root = ctx.worktreePath ?? process.cwd();
      const dir = join(root, ".pstdio", "sessions");
      mkdirSync(dir, { recursive: true });

      appendFileSync(
        join(dir, "await-input.log"),
        `${new Date().toISOString()} ${ctx.sessionId} awaiting_input\n`,
      );
    },
  },
});
```

### Attempt Status Hooks

### Validate before moving an attempt to `review-ready`

```ts
// .pstdio/plugins/code-review-lifecycle.ts
import { definePlugin, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preAttemptStatusChange(ctx) {
      if (ctx.toStatus !== "review-ready") return;
      if (!ctx.worktreePath) return;

      const validation = await runCommand(ctx.worktreePath, ["bun", "run", "validate"]);
      if (validation.exitCode === 0) return;

      const output = [validation.stdout, validation.stderr].join("\n").trim();
      return {
        reject: true,
        reason: output
          ? `Validation failed; cannot move to review-ready\n\n${output}`
          : "Validation failed; cannot move to review-ready",
      };
    },
  },
});
```

### Launch review on `review-ready`, then route changes back to the original session

```ts
// .pstdio/plugins/code-review-lifecycle.ts
import {
  createSession,
  definePlugin,
  followupSession,
  setWorkspaceAttemptStatus,
} from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postAttemptStatusChange(ctx) {
      if (!ctx.ticket) return;

      if (ctx.toStatus === "review-ready") {
        await createSession(ctx, {
          workspace_id: ctx.workspace.id,
          title: `Code review: ${ctx.ticket.shorthand}`,
          template: "review-code",
          vars: { ticket: ctx.ticket.shorthand },
          original_session_id: ctx.sessionId,
        });
      }

      if (ctx.toStatus === "changes-requested") {
        await setWorkspaceAttemptStatus(ctx, {
          workspaceId: ctx.workspace.id,
          sessionId: ctx.sessionId,
          statusName: "wip",
        });

        await followupSession(ctx, {
          sessionId: ctx.originalSessionId,
          template: "fix-changes-requested",
          vars: { ticket: ctx.ticket.shorthand },
        });
      }
    },
  },
});
```

### Ticket Hooks

### Prevent archiving tickets that are still in progress

```ts
// .pstdio/plugins/ticket-archive-guard.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    preTicketArchive(ctx) {
      if (ctx.status !== "wip") return;

      return {
        reject: true,
        reason: "Cannot archive a ticket that is still in progress.",
      };
    },
  },
});
```

### Remove all worktrees when a ticket is archived

```ts
// .pstdio/plugins/worktree-lifecycle.ts
import { definePlugin, removeAllWorktreesForTicket } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketArchive(ctx) {
      await removeAllWorktreesForTicket(ctx, { ticketId: ctx.id });
    },
  },
});
```

### Log ticket status transitions

```ts
// .pstdio/plugins/ticket-status-log.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    postTicketStatusChange(ctx) {
      console.log(
        `[pstdio] ${new Date().toISOString()} ${ctx.shorthand}: ${ctx.fromStatus} -> ${ctx.toStatus}`,
      );
    },
  },
});
```

### Require ticket content before creation

```ts
// .pstdio/plugins/ticket-create-guard.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    preTicketCreation(ctx) {
      if (ctx.content?.trim()) return;

      return {
        reject: true,
        reason: "Ticket must include content.",
      };
    },
  },
});
```

## Actions

Actions are user-triggered commands bound to a `ticket`, `workspace`, or `session`. The dashboard renders each action as a button or menu item on the matching target, collects any declared `params`, and calls `trigger(ctx)`. Return `{ session_id?, message? }` to surface a toast + link in the UI.

### Run a ticket attempt from a button

```ts
// .pstdio/plugins/ticket-actions.ts
import { createAttempt, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-attempt",
      label: "Run attempt",
      targetType: "ticket",
      placement: "primary",
      params: [
        { key: "agent", label: "Agent", type: "agent" },
        { key: "repo", label: "Repository", type: "repo" },
      ],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const repo = ctx.params.repo as { repo: string; branch: string } | undefined;

        await createAttempt(ctx, {
          ticketId: ctx.target.shorthand,
          agent: agent?.agent,
          model: agent?.model,
          repo_id: repo?.repo,
          branch: repo?.branch,
          prompt: `Implement ticket: ${ctx.target.shorthand}`,
        });
      },
    },
  ],
});
```

### Launch a manual code-review session from a workspace

```ts
// .pstdio/plugins/workspace-actions.ts
import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      params: [{ key: "agent", label: "Agent", type: "agent" }],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const ticketId = ctx.target.ticket_shorthand || null;

        await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          agent: agent?.agent,
          model: agent?.model,
          template: "review-code",
          vars: ticketId ? { ticket: ticketId } : {},
        });
      },
    },
  ],
});
```

### Break a ticket into sub-tickets (action with a template param)

```ts
// .pstdio/plugins/ticket-actions.ts
import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "break-into-sub-tickets",
      label: "Break into sub-tickets",
      targetType: "ticket",
      placement: "overflow",
      params: [
        { key: "agent", label: "Agent", type: "agent" },
        { key: "template", label: "Template", type: "template-select", templateType: "ticket", required: false },
      ],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const template = ctx.params.template as string | undefined;

        const parts = [`Breakdown ticket: ${ctx.target.shorthand} into sub-tickets`];
        if (template) parts.push(`Use template: ${template}`);

        await createSession(ctx, {
          title: `Break into sub-tickets: ${ctx.target.shorthand}`,
          agent: agent?.agent,
          model: agent?.model,
          prompt: parts.join("\n\n"),
        });
      },
    },
  ],
});
```

### Refine a ticket with free-form context (action with a longtext param)

```ts
// .pstdio/plugins/ticket-actions.ts
import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "refine-ticket",
      label: "Refine ticket",
      targetType: "ticket",
      placement: "overflow",
      params: [
        { key: "agent", label: "Agent", type: "agent" },
        { key: "context", label: "Additional context", type: "longtext", required: false },
      ],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const context = ctx.params.context as string | undefined;

        const parts = [`Refine ticket: ${ctx.target.shorthand}`];
        if (context) parts.push(`Additional context:\n${context}`);

        await createSession(ctx, {
          title: `Refine ticket: ${ctx.target.shorthand}`,
          agent: agent?.agent,
          model: agent?.model,
          prompt: parts.join("\n\n"),
        });
      },
    },
  ],
});
```

### Plugin with both hooks and actions

```ts
// .pstdio/plugins/ticket-workflow.ts
import { createSession, definePlugin, setTicketStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  key: "ticket-workflow",
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;
      await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
    },
  },
  actions: [
    {
      key: "schedule-review",
      label: "Schedule review",
      targetType: "ticket",
      placement: "overflow",
      params: [{ key: "agent", label: "Agent", type: "agent" }],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        await createSession(ctx, {
          title: `Review: ${ctx.target.shorthand}`,
          agent: agent?.agent,
          model: agent?.model,
          template: "review-code",
          vars: { ticket: ctx.target.shorthand },
        });
      },
    },
  ],
});
```
