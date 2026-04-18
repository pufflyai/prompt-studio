# Plugin Examples

## 1) Lifecycle Hook Plugin

```ts
import { definePlugin, setTicketStatus } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postSessionStart(ctx) {
      if (!ctx.ticket) return;
      await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
    },
  },
});
```

## 2) Blocking Pre Hook

```ts
import { definePlugin, runCommand } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async preCommit(ctx) {
      const result = await runCommand(ctx.worktreePath, ["bun", "run", "validate"]);
      if (result.exitCode === 0) return;
      return { reject: true, reason: "Validation failed" };
    },
  },
});
```

## 3) Scheduled Cron Plugin

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  schedules: [
    {
      name: "hourly-health-check",
      cron: "0 * * * *",
      timeoutSeconds: 30,
      async trigger(ctx) {
        console.log(
          `[scheduled] project=${ctx.projectId} schedule=${ctx.scheduleName} runId=${ctx.runId}`,
        );
      },
    },
  ],
});
```

## 4) Action Plugin

```ts
import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    {
      key: "review-ticket",
      label: "Request Review",
      targetType: "ticket",
      placement: "primary",
      async trigger(ctx) {
        const session = await createSession(ctx, {
          title: `Review ${ctx.target.shorthand}`,
          template: "code-review",
          vars: { ticket: ctx.target.shorthand },
        });

        return { session_id: session.id, message: "Review session created" };
      },
    },
  ],
});
```

## 5) Mixed Plugin (Hooks + Actions + Schedules)

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    postTicketCreation(ctx) {
      console.log(`created ticket ${ctx.shorthand}`);
    },
  },
  actions: [
    {
      key: "ping",
      label: "Ping",
      targetType: "workspace",
      placement: "overflow",
      trigger() {
        return { message: "pong" };
      },
    },
  ],
  schedules: [
    {
      name: "daily-log",
      cron: "0 9 * * *",
      trigger(ctx) {
        console.log(`daily job for ${ctx.projectId}`);
      },
    },
  ],
});
```
