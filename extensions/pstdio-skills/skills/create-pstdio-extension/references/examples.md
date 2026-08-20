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
      supportedRegions: ["main"],
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

The panel wraps the renderer and declares the regions it supports. The `treeItems` panel action makes it reachable
from the project sidenav.

## Workbench Panels And Resource Slots

A panel declares what it renders and which docked regions it supports. It never places itself. The resource kind
owns named slots; a `resourcePanels` entry binds one panel to one slot. The active mode's recipe then places each
slot into a region.

The resource owner declares the kind, its slots, and its own panels:

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  resourceKinds: {
    ticket: {
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        inspector: { cardinality: "many", external: true },
      },
    },
  },
  panels: {
    ticketEditor: {
      title: "Ticket",
      supportedRegions: ["main"],
      webview: { entry: packageAsset("./src/ticket-editor.tsx", import.meta.url) },
    },
  },
  resourcePanels: {
    ticketEditor: { resourceKind: "ticket", panel: "ticketEditor", slot: "primary" },
  },
});
```

Another extension contributes an optional panel to the open `inspector` slot. Cross-extension references use the
namespaced `<extension>.<id>` form; bare ids resolve inside the declaring extension:

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  panels: {
    insights: {
      title: "Insights",
      supportedRegions: ["side", "secondary"],
      renderer: { kind: "controls", id: "insightControls" },
    },
  },
  resourcePanels: {
    ticketInsights: { resourceKind: "planner.ticket", panel: "insights", slot: "inspector" },
  },
});
```

A slot with `external: false` rejects contributions from other extensions during `pst extensions check`
(`extension_resource_slot_closed`). The `primary` slot is always closed to external panels.

## Native Resource Detail Mode

Use this pattern for host-rendered resource screens: the file renderer owns document content, the tree renderer owns
side-panel navigation, the resource kind exposes the slots, and the mode recipe places them.

```ts
import { defineExtension, l10n } from "@pstdio/sdk/extensions";

export default defineExtension({
  resourceKinds: {
    note: {
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        navigation: { cardinality: "many", external: true },
      },
    },
  },
  modes: {
    note: {
      id: "notes.note",
      label: l10n("modes.note.label", "Note"),
      icon: "FileText",
      panelRegions: ["main", "secondary", "side"],
      resources: {
        note: {
          slots: {
            primary: { region: "main", required: true },
            navigation: { region: "sidenav", pinned: true },
          },
        },
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
      supportedRegions: ["main"],
      renderer: { kind: "file", id: "noteContent" },
    },
    noteTree: {
      title: l10n("panels.noteTree.title", "Files"),
      supportedRegions: ["sidenav"],
      renderer: { kind: "tree", id: "noteTree" },
    },
  },
  resourcePanels: {
    noteEditor: { resourceKind: "note", panel: "noteEditor", slot: "primary" },
    noteTree: { resourceKind: "note", panel: "noteTree", slot: "navigation" },
  },
  resourceHierarchyProviders: {
    note: {
      resourceKind: "note",
      parent: async (_ctx, resource) => (resource.id === "root" ? null : { type: "note", id: "root" }),
    },
  },
});
```

`resourceHierarchyProviders` gives the host the parent of a resource. Breadcrumbs follow that chain; return `null` at
the root.

The mode's `resources` recipe accepts the `note` kind and maps its slots to regions. `required: true` makes a
placement structural: the host restores it whenever the mode-resource context activates, and the user cannot close
it. A slot placement can be `required` only when the slot's cardinality is `one`; for a cardinality-many slot, name
the panel in the recipe's `panels` map instead. `panelRegions` lists the host chrome regions (`main`, `secondary`, `side`) the mode exposes; the side region
stays host-owned for the Side Panel. A mode can also place a specific known panel with a `panels` map inside the
recipe (it wins over the slot placement), open mode-wide panels with `modePanels`, and name a `defaultResource` so
users can enter the mode without a compatible resource.

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
