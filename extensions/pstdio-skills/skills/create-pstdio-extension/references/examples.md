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

## Dashboard page

```ts
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const tasks = defineView({
  id: "tasks",
  title: "Tasks",
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

const tasksPage = definePage({
  id: "tasks",
  title: "Tasks",
  path: "tasks",
  mode: workbenchModes.project,
  slots: [{ id: "content", role: "primary", region: "main", view: tasks.ref }],
});

export default defineExtension({
  views: [tasks],
  pages: [tasksPage],
  navigationItems: [
    defineNavigationItem({
      id: "tasks",
      owner: workbenchModes.project,
      slot: "content",
      label: "Tasks",
      action: { kind: "page", page: tasksPage.ref },
    }),
  ],
});
```

The view owns the board body. The page owns its route and placement.

## Resource detail page

A resource kind defines identity and menus. A page slot binds that resource to its view.

```ts
import {
  defineExtension,
  definePage,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchModes,
  workbenchPages,
} from "@pstdio/sdk/extensions";

export const ticket = defineResourceKind({ id: "ticket", label: "Ticket", icon: "ticket" });
const editor = defineView({
  id: "ticket-editor",
  title: "Ticket",
  body: { kind: "webview", entry: packageAsset("./src/ticket-editor.tsx", import.meta.url) },
});

export const ticketPage = definePage({
  id: "ticket",
  title: "Ticket",
  path: "ticket",
  mode: workbenchModes.project,
  parent: workbenchPages.start,
  slots: [
    {
      id: "content",
      role: "primary",
      region: "main",
      binding: { kind: ticket.ref, view: editor.ref, cardinality: "one" },
    },
  ],
});

export default defineExtension({
  resourceKinds: [ticket],
  views: [editor],
  pages: [ticketPage],
});
```

The binding declares `cardinality`. `one` keeps a single instance and rebinds it when another ticket opens. `many` opens one instance per resource. A page whose primary slot has only a binding must declare `parent`; closing its last tab navigates there.

Navigation always names the destination page:

```ts
const target = {
  kind: "page" as const,
  page: ticketPage.ref,
  resource: { type: "ticket", id: "PS-326", label: "PS-326" },
};
```

## Native resource detail page with navigation

Use this pattern for host-rendered resource screens: a page owns the routed primary view, while a page-owned
navigation tree adds contextual rows to the shared Sidenav.

```ts
import {
  defineExtension,
  defineNavigationTree,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
  workbenchPages,
} from "@pstdio/sdk/extensions";

const note = defineResourceKind({ id: "note", label: "Note" });
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
const notePage = definePage({
  id: "note",
  title: "Note",
  path: "note",
  mode: workbenchModes.project,
  parent: workbenchPages.start,
  slots: [
    {
      id: "content",
      role: "primary",
      region: "main",
      binding: { kind: note.ref, view: content.ref, cardinality: "one" },
    },
  ],
});

export default defineExtension({
  resourceKinds: [note],
  views: [content, files],
  pages: [notePage],
  navigationTrees: [
    defineNavigationTree({ id: "files", owner: notePage.ref, slot: "content", view: files.ref }),
  ],
});
```

The files tree appears together with mode navigation and disappears when the page is no longer active.

## Webview page

```ts
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const planner = defineView({
  id: "planner",
  title: "Planner",
  body: {
    kind: "webview",
    entry: packageAsset("./src/main.tsx", import.meta.url),
    capabilities: ["commands.execute", "notification.show"],
  },
});

const plannerPage = definePage({
  id: "planner",
  title: "Planner",
  path: "planner",
  mode: workbenchModes.project,
  slots: [{ id: "content", role: "primary", region: "main", view: planner.ref }],
});

export default defineExtension({
  views: [planner],
  pages: [plannerPage],
  navigationItems: [
    defineNavigationItem({
      id: "planner",
      owner: workbenchModes.project,
      slot: "content",
      label: "Planner",
      icon: "calendar-check",
      action: { kind: "page", page: plannerPage.ref },
    }),
  ],
});
```

The page ref is the navigation target. Its path is the deep link.

## Webview files and navigation

Declare each host call on the view body:

```ts
const imports = defineView({
  id: "imports",
  title: "Imports",
  body: {
    kind: "webview",
    entry: packageAsset("./src/imports.ts", import.meta.url),
    capabilities: ["files.upload", "files.list", "files.delete", "navigation.open"],
  },
});
```

The webview receives the file client from `defineExtensionView`:

```ts
export default defineExtensionView({
  async render({ files, host }) {
    const [selected] = await files.pick({ accept: ".csv,text/csv" });
    if (!selected) return;

    const uploaded = await files.upload({
      name: selected.name,
      data: await selected.arrayBuffer(),
      mimeType: selected.type || "text/csv",
    });
    const projectFiles = await files.list();

    await host.call("navigation.open", {
      target: {
        kind: "page",
        page: { kind: "page", id: "ticket" },
        resource: { type: "ticket", id: uploaded.id, label: uploaded.name },
      },
    });

    await files.delete(uploaded.id);
  },
});
```

`files.pick()` stays in the browser. The other methods cross the host bridge. The host
sets the active project and extension instance, so guest code cannot select another
owner. Omit scope for project files, or pass the same `{ type, id }` scope to upload and
list. Global settings webviews have no project file owner and cannot use host-backed
file methods.

This example targets the extension's `ticket` page. The host does not choose a presenter from the resource kind.
