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
        examples: ["pst planner release prepare --version 1.2.3"],
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

## Hook On Session Completion

```ts
import { defineExtension, sessionEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    recordCompletedSession: {
      event: sessionEvents.completed,
      async handler(ctx, payload) {
        await ctx.activity.record({
          message: `Session ${payload.sessionId} completed`,
          target: { type: "session", id: payload.sessionId },
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

## Dashboard Data Renderer

```ts
import {
  commandRef,
  defineExtension,
} from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    "tasks.query": {
      title: "Query tasks",
      async run() {
        return {
          attributes: [
            { id: "status", label: "Status", type: { kind: "string" } },
          ],
          rows: [
            { id: "task-1", title: "Draft plan", attributes: { status: "Backlog" } },
          ],
        };
      },
    },
  },
  dataRenderers: {
    tasks: {
      title: "Tasks",
      resourceKind: "task",
      queryCommand: commandRef("planner.tasks.query"),
      defaultSettings: {
        viewMode: "list",
        columnGrouping: "none",
        rowGrouping: "none",
        displayProperties: ["status"],
      },
      emptyTitle: "No tasks",
      emptyDescription: "Create a task to start planning.",
    },
  },
});
```

`dataRenderers` are automatically listed in the project sidebar. Do not add a `treeItems` entry with
`action.kind === "dataRenderer"`.

## Dashboard Route Tree Item

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

Route tree items use the route `path` (`"planner"` above), not the normalized route id.
