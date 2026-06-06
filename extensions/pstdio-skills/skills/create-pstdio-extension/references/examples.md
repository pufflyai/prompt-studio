# Extension Examples

## Command With CLI And Dashboard Menu

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    "release.prepare": {
      title: "Prepare release",
      description: "Create release notes and run the release preflight.",
      cli: {
        path: ["release", "prepare"],
        examples: ["pstdio planner release prepare --version 1.2.3"],
      },
      palette: { label: "Prepare release" },
      params: {
        version: params.text({ label: "Version", required: true }),
      },
      async run(ctx) {
        await ctx.notify.toast({
          type: "info",
          title: "Release",
          message: `Preparing ${ctx.params.version}`,
        });

        return { version: ctx.params.version };
      },
    },
  },
});
```

## Middleware Validation

```ts
import { commandRef, defineExtension, params } from "@pstdio/sdk/extensions";

const publishCommand = commandRef<{ version: string }, { published: boolean }>(
  "planner.release.publish",
);

export default defineExtension({
  commands: {
    "release.publish": {
      title: "Publish release",
      params: {
        version: params.text({ required: true }),
      },
      async run(ctx) {
        return { published: true, version: ctx.params.version };
      },
    },
  },
  middlewares: {
    requireSemver: {
      command: publishCommand,
      async handler(ctx) {
        if (!/^\d+\.\d+\.\d+$/.test(ctx.params.version)) {
          return ctx.commands.reject({
            code: "invalid_version",
            reason: "Version must be a semver string.",
          });
        }
      },
    },
  },
});
```

## Hook On Ticket Status Changes

```ts
import { defineExtension, ticketEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    recordDoneTicket: {
      event: ticketEvents.statusChanged,
      async handler(ctx, event) {
        if (event.toStatus !== "done") return;

        await ctx.activity.record({
          message: `Ticket ${event.ticket.shorthand} is done`,
          target: { type: "ticket", id: event.ticket.id },
        });
      },
    },
  },
});
```

## Worktree Bootstrap Hook

```ts
import { defineExtension, worktreeEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    bootstrapWorktree: {
      event: worktreeEvents.created,
      async handler(ctx, event) {
        await ctx.worktrees.bootstrap({
          repoPath: event.repoPath,
          worktreePath: event.worktreePath,
        });

        await ctx.process.runOrThrow({
          command: ["bun", "install"],
          cwd: event.worktreePath,
        });
      },
    },
  },
});
```

## Schedule

```ts
import { commandRef, defineExtension } from "@pstdio/sdk/extensions";

const heartbeat = commandRef("planner.heartbeat");

export default defineExtension({
  commands: {
    heartbeat: {
      title: "Heartbeat",
      async run(ctx) {
        ctx.logger.info("Planner heartbeat", { projectId: ctx.projectId });
        return { ok: true };
      },
    },
  },
  schedules: {
    heartbeat: {
      title: "Planner heartbeat",
      cron: "*/15 * * * *",
      command: heartbeat,
    },
  },
});
```

## Templates And Skills

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  templates: {
    releaseNotes: {
      title: "Release Notes",
      type: "document",
      source: packageAsset("./templates/release-notes.md", import.meta.url),
    },
  },
  skills: {
    releaseManager: {
      title: "Release manager",
      source: packageAsset("./skills/release-manager", import.meta.url),
    },
  },
});
```

## Artifact Mount

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  artifactMounts: {
    reports: {
      path: "reports",
      label: "Reports",
      repoRole: "default",
    },
  },
  commands: {
    "reports.write": {
      title: "Write report",
      async run(ctx) {
        await ctx.artifacts.mount("reports").writeText("latest.txt", "done\n");
        return { path: "latest.txt" };
      },
    },
  },
});
```

## Dashboard Route And Navigation

```ts
import {
  defineExtension,
  packageAsset,
} from "@pstdio/sdk/extensions";

export default defineExtension({
  routes: {
    planner: {
      path: "planner",
      label: "Planner",
      webview: {
        entry: packageAsset("./src/main.tsx", import.meta.url),
        capabilities: ["commands.execute", "notification.show"],
      },
    },
  },
  treeItems: {
    planner: {
      target: "workbench.left.tree",
      label: "Planner",
      icon: "calendar-check",
      action: { kind: "route", route: "planner" },
      when: { mode: "project" },
    },
  },
});
```
