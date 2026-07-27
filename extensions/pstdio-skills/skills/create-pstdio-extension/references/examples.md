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

## Workspace Provisioning Hook

`workspace.provision` is awaited: it gates session launch until your hook resolves, so use it to
materialize files a session needs (e.g. an agent's skills dir). Long background setup belongs in the
fire-and-forget `workspace.ready` hook.

```ts
import { defineExtension, workspaceEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    provision: {
      event: workspaceEvents.provision,
      async handler(ctx) {
        const skills = (await ctx.skills?.list?.()) ?? [];
        const files = skills.flatMap((skill) =>
          skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
        );

        // Reconcile the agent dir to exactly these files (writes atomically, prunes the rest).
        if (ctx.workspaceFiles) await ctx.workspaceFiles.syncDir(".claude/skills", files);
      },
    },
    ready: {
      event: workspaceEvents.ready,
      async handler(_ctx, event) {
        await _ctx.process.runOrThrow({ command: ["bun", "install"], cwd: event.workspaceDir });
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

## Dashboard Kanban Renderer

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
  kanbanRenderers: {
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

`kanbanRenderers` are automatically listed in the project sidenav. Do not add a `treeItems` entry with
`action.kind === "kanbanRenderer"`.

## Native Resource Detail Mode

Use this pattern for host-rendered resource screens: the file renderer owns document content, the tree renderer owns
side-panel navigation, and the mode layout pins the tree.

```ts
import { commandRef, defineExtension, l10n } from "@pstdio/sdk/extensions";

export default defineExtension({
  modes: {
    note: {
      id: "notes.note",
      label: l10n("modes.note.label", "Note"),
      icon: "FileText",
      resourceKind: "note",
      layout: {
        panels: ["main", "secondary", "side"],
        open: [{ region: "sidenav", panel: "noteTree", pinned: true }],
      },
    },
  },
  fileRenderers: {
    noteContent: {
      title: l10n("fileRenderers.noteContent.title", "Note"),
      resourceKind: "note",
      loadCommand: commandRef("notes.load-note"),
      saveCommand: commandRef("notes.save-note"),
    },
  },
  treeRenderers: {
    noteTree: {
      title: l10n("treeRenderers.noteTree.title", "Files"),
      icon: "Files",
      bodyCommand: commandRef("notes.note-tree.body"),
      defaultExpandedSectionIds: ["files"],
    },
  },
  panels: {
    noteEditor: {
      title: l10n("panels.noteEditor.title", "Note"),
      region: "main",
      closable: false,
      resourceKind: "note",
      fileRenderer: "noteContent",
    },
    noteTree: {
      title: l10n("panels.noteTree.title", "Files"),
      region: "sidenav",
      closable: false,
      resourceKind: "note",
      treeRenderer: "noteTree",
      hostTreeHeader: "default",
    },
  },
});
```

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
