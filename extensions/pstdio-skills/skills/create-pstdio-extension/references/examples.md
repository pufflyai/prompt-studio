# Extension examples

## Command with CLI and dashboard menu

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
      async run(ctx, commandParams) {
        await ctx.notify.toast({
          type: "info",
          title: "Release",
          message: `Preparing ${commandParams.version}`,
        });

        return { version: commandParams.version };
      },
    },
  },
});
```

## Middleware validation

```ts
import { commandRef, defineExtension, params } from "@pstdio/sdk/extensions";

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "planner" });
const publishCommand = plannerCommand<{ version: string }, { published: boolean }>("release.publish");

export default defineExtension({
  commands: {
    "release.publish": {
      title: "Publish release",
      params: {
        version: params.text({ required: true }),
      },
      async run(_ctx, commandParams) {
        return { published: true, version: commandParams.version };
      },
    },
  },
  middlewares: {
    requireSemver: {
      command: publishCommand,
      async handler(ctx, commandParams) {
        if (!/^\d+\.\d+\.\d+$/.test(commandParams.version)) {
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

## Hook on session completion

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

## Workspace provisioning hook

`workspace.provision` is awaited: it gates session launch until your hook resolves, so use it to
materialize files a session needs (e.g. an agent's skills dir). Long background setup belongs in the
fire-and-forget `workspace.ready` hook.

```ts
import { defineExtension, workspaceEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    provision: {
      event: workspaceEvents.provision,
      async handler(ctx, _event) {
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

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "planner" });
const heartbeat = plannerCommand("heartbeat");

export default defineExtension({
  commands: {
    heartbeat: {
      title: "Heartbeat",
      async run(ctx, _commandParams) {
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

## Templates and skills

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

## Artifact mount

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
      async run(ctx, _commandParams) {
        await ctx.artifacts.mount("reports").writeText("latest.txt", "done\n");
        return { path: "latest.txt" };
      },
    },
  },
});
```

## Dashboard Kanban view

```ts
import {
  defineExtension,
  defineNavigationItem,
  definePlacement,
  defineView,
  workbenchModes,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const tasks = defineView({
  id: "tasks",
  title: "Tasks",
  path: "tasks",
  body: {
    kind: "kanban",
    attributes: [{ id: "status", label: "Status", type: { kind: "string" } }],
    query: async () => ({ rows: [] }),
    defaultSettings: {
      viewMode: "list",
      columnGrouping: "none",
      rowGrouping: "none",
      displayProperties: ["status"],
    },
  },
});

export default defineExtension({
  views: [tasks],
  placements: [
    definePlacement({ id: "tasks", mode: workbenchModes.project, item: { kind: "view", view: tasks.ref }, region: "main" }),
  ],
  navigationItems: [
    defineNavigationItem({ id: "tasks", slot: workbenchSlots.projectNavigation, label: "Tasks", action: { kind: "view", view: tasks.ref } }),
  ],
});
```

The view owns the board. The placement owns its region, and the navigation item opens the same typed view ref.

## Resource views and slots

A resource kind owns semantic slots. A resource view binds a view to one slot. A placement decides where the slot
appears for a mode.

```ts
import {
  defineExtension,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineView,
  packageAsset,
  resourceSlotRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

export const ticket = defineResourceKind({
  id: "ticket",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "inspector", cardinality: "many", access: "public" },
  ],
});
export const primary = resourceSlotRef(ticket.ref, "primary");
export const inspector = resourceSlotRef(ticket.ref, "inspector");
const editor = defineView({
  id: "ticket-editor",
  title: "Ticket",
  body: { kind: "webview", entry: packageAsset("./src/ticket-editor.tsx", import.meta.url) },
});

export default defineExtension({
  resourceKinds: [ticket],
  views: [editor],
  resourceViews: [
    defineResourceView({ id: "editor", resourceKind: ticket.ref, slot: primary, view: editor.ref }),
  ],
  placements: [
    definePlacement({ id: "primary", mode: workbenchModes.project, item: { kind: "resource-slot", slot: primary }, region: "main", required: true }),
  ],
});
```

Another extension can bind a view to the exported public inspector slot:

```ts
import { defineExtension, defineResourceView, defineView } from "@pstdio/sdk/extensions";
import { inspector, ticket } from "pstdio-planner/ui";

const insights = defineView({
  id: "ticket-insights",
  title: "Insights",
  body: { kind: "controls", query: async () => ({ values: {} }) },
});

export default defineExtension({
  views: [insights],
  resourceViews: [
    defineResourceView({ id: "ticket-insights", resourceKind: ticket.ref, slot: inspector, view: insights.ref }),
  ],
});
```

A slot with `access: "owner"` rejects another extension's binding during `pst extensions check`. The primary slot is always owner-only.

## Native resource detail mode

Use this pattern for host-rendered resource screens: native views own content, the resource kind exposes semantic
slots, resource-view bindings connect them, and placements own geometry.

```ts
import {
  defineExtension,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineView,
  resourceSlotRef,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const note = defineResourceKind({
  id: "note",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "navigation", cardinality: "one", access: "public" },
  ],
});
const primary = resourceSlotRef(note.ref, "primary");
const navigation = resourceSlotRef(note.ref, "navigation");
const content = defineView({
  id: "note-content",
  title: "Note",
  body: {
    kind: "file",
    load: async (_ctx, input) => ({ fileName: "note.md", content: `# ${input.renderer.resource.label}` }),
  },
});
const files = defineView({
  id: "note-files",
  title: "Files",
  body: { kind: "tree", body: async () => [{ id: "files", label: "Files", nodes: [] }] },
});

export default defineExtension({
  resourceKinds: [note],
  views: [content, files],
  resourceViews: [
    defineResourceView({ id: "content", resourceKind: note.ref, slot: primary, view: content.ref }),
    defineResourceView({ id: "files", resourceKind: note.ref, slot: navigation, view: files.ref }),
  ],
  placements: [
    definePlacement({ id: "content", mode: workbenchModes.project, item: { kind: "resource-slot", slot: primary }, region: "main", required: true }),
    definePlacement({ id: "files", mode: workbenchModes.project, item: { kind: "resource-slot", slot: navigation }, region: "sidenav", required: true }),
  ],
});
```

`required: true` makes a cardinality-one placement structural. The host restores it when
the mode-resource context activates, and the user cannot close it.

## Dashboard navigation item

```ts
import {
  defineExtension,
  defineNavigationItem,
  defineView,
  packageAsset,
  workbenchSlots,
} from "@pstdio/sdk/extensions";

const planner = defineView({
  id: "planner",
  path: "planner",
  title: "Planner",
  body: {
    kind: "webview",
    entry: packageAsset("./src/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});

export default defineExtension({
  views: [planner],
  navigationItems: [
    defineNavigationItem({
      id: "planner",
      slot: workbenchSlots.projectNavigation,
      label: "Planner",
      icon: "calendar-check",
      action: { kind: "view", view: planner.ref },
    }),
  ],
});
```

The view ref is the navigation target. Its `path` remains the deep link.
