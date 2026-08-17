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
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  kanbanRenderers: {
    tasks: {
      title: "Tasks",
      resourceKind: "task",
      query: async () => ({
        attributes: [{ id: "status", label: "Status", type: { kind: "string" } }],
        rows: [{ id: "task-1", title: "Draft plan", attributes: { status: "Backlog" } }],
      }),
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
  panels: {
    tasks: {
      title: "Tasks",
      region: "main",
      closable: false,
      renderer: { kind: "kanban", id: "tasks" },
    },
  },
  treeItems: {
    tasks: {
      target: "workbench.left.tree",
      label: "Tasks",
      action: { kind: "panel", panel: "tasks" },
    },
  },
});
```

The Panel places the renderer. The `treeItems` panel action makes it reachable from the project sidenav.

## Workbench Panels

Use a panel without `eligibleLocations` for full content. Use `eligibleLocations` only when the panel should be a
supporting sub-panel or tab.

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  panels: {
    ticketEditor: {
      title: "Ticket",
      region: "main",
      closable: false,
      resourceKind: "ticket",
      webview: { entry: packageAsset("./src/ticket-editor.tsx", import.meta.url) },
    },
    notesTab: {
      title: "Notes",
      region: "secondary",
      closable: true,
      eligibleLocations: {},
      webview: { entry: packageAsset("./src/notes.tsx", import.meta.url) },
    },
    ticketFilesTab: {
      title: "Ticket files",
      region: "secondary",
      closable: true,
      eligibleLocations: { resourceKinds: ["ticket"] },
      webview: { entry: packageAsset("./src/ticket-files.tsx", import.meta.url) },
    },
  },
});
```

`eligibleLocations: {}` is valid, but it creates an everywhere-eligible supporting tab. `pst extensions check`
reports `extension_panel_empty_eligible_locations` so you can decide whether to keep it or add constraints.

## Native Resource Detail Mode

Use this pattern for host-rendered resource screens: the file renderer owns document content, the tree renderer owns
side-panel navigation, and the mode layout pins the tree.

```ts
import { defineExtension, l10n } from "@pstdio/sdk/extensions";

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
      load: async (_ctx, input) => ({
        fileName: "note.md",
        content: `# ${input.renderer.resource.label}`,
      }),
      save: async (_ctx, input) => {
        await saveNote(input.renderer.resource, input.content);
      },
    },
  },
  treeRenderers: {
    noteTree: {
      title: l10n("treeRenderers.noteTree.title", "Files"),
      icon: "Files",
      body: async () => [{ id: "files", label: "Files", nodes: [] }],
      defaultExpandedSectionIds: ["files"],
    },
  },
  panels: {
    noteEditor: {
      title: l10n("panels.noteEditor.title", "Note"),
      region: "main",
      closable: false,
      resourceKind: "note",
      renderer: { kind: "file", id: "noteContent" },
    },
    noteTree: {
      title: l10n("panels.noteTree.title", "Files"),
      region: "sidenav",
      closable: false,
      resourceKind: "note",
      renderer: { kind: "tree", id: "noteTree" },
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
