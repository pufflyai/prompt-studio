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
  definePage,
  defineView,
  workbenchSlots,
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
  slots: [{ id: "board", region: "main", view: tasks.ref, closable: false }],
});

export default defineExtension({
  views: [tasks],
  pages: [tasksPage],
  navigationItems: [
    defineNavigationItem({ id: "tasks", slot: workbenchSlots.projectNavigation, label: "Tasks", action: { kind: "page", page: tasksPage.ref } }),
  ],
});
```

The view owns the board and never claims a place. The page puts it on the bench and owns the URL (`/projects/{project}/{extension-id}/tasks`); the navigation item targets the page ref.

## Resource screen (a page with bindings)

A resource kind owns data only. A page binds it to views and owns the whole screen: slots, tabs, and open policy. This is the planner tickets shape (`extensions/pstdio-planner/src/ui-contributions.ts`).

```ts
import { defineExtension, definePage, defineResourceKind, defineView } from "@pstdio/sdk/extensions";

export const ticket = defineResourceKind({
  id: "ticket",
  label: "Ticket",
  icon: "ticket",
});
const board = defineView({
  id: "tickets",
  title: "Tickets",
  body: { kind: "kanban", attributes: [], query: async () => ({ rows: [] }) },
});
const editor = defineView({
  id: "ticket-editor",
  title: "Ticket",
  body: { kind: "file", load: async () => ({ content: "" }) },
});
const files = defineView({
  id: "ticket-files",
  title: "Files",
  body: { kind: "tree", body: async () => [{ id: "files", label: "Files", nodes: [] }] },
});

export const ticketsPage = definePage({
  id: "tickets",
  title: "Tickets",
  path: "tickets",
  slots: [
    { id: "board", region: "main", view: board.ref, closable: false },
    { id: "ticket", region: "main", cardinality: "many" },
    { id: "files", region: "sidenav", follows: "ticket" },
  ],
  bindings: [
    { resourceKind: ticket.ref, view: editor.ref, slot: "ticket" },
    { resourceKind: ticket.ref, view: files.ref, slot: "files" },
  ],
});

export default defineExtension({
  resourceKinds: [ticket],
  views: [board, editor, files],
  pages: [ticketsPage],
});
```

Clicking a board row emits the ticket. The page's bindings open it as a preview tab next to the board and fill the files tree, which follows the active ticket tab. The board tab cannot be closed while the page is open (`closable: false`). Pinning a preview tab (double-click, or `open: "pin"` on a page target) stacks tickets as tabs.

Another extension presents the same kind its own way by declaring its own page that binds the exported kind ref. The caller's choice of page is the choice of presentation:

```ts
import { defineExtension, definePage, defineView } from "@pstdio/sdk/extensions";
import { ticket } from "pstdio-planner/ui";

const review = defineView({
  id: "ticket-review",
  title: "Review",
  body: { kind: "controls", query: async () => ({ values: {} }) },
});

const reviewPage = definePage({
  id: "review",
  title: "Review",
  path: "review",
  slots: [{ id: "ticket", region: "main", cardinality: "many" }],
  bindings: [{ resourceKind: ticket.ref, view: review.ref, slot: "ticket" }],
});

export default defineExtension({ views: [review], pages: [reviewPage] });
```

A command opens a ticket in either presentation by naming the page: `{ navigate: { kind: "page", page: reviewPage.ref, resource: ticketRef } }`. Native screens work the same way through host page refs: `{ kind: "page", page: workbenchPages.workspaces, resource: workspaceRef }`.

## Smallest tool screen

One view, one page with one static unclosable slot, one navigation item. This is the font-editor shape (`.pstdio/extensions/font-editor/extension.ts`).

```ts
import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineView,
  packageAsset,
  workbenchSlots,
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
  slots: [{ id: "main", region: "main", view: planner.ref, closable: false }],
});

export default defineExtension({
  views: [planner],
  pages: [plannerPage],
  navigationItems: [
    defineNavigationItem({
      id: "planner",
      slot: workbenchSlots.projectNavigation,
      label: "Planner",
      icon: "calendar-check",
      action: { kind: "page", page: plannerPage.ref },
    }),
  ],
});
```

The page ref is the navigation target, and the page's `path` is the deep link. There is no mode, placement, or anchor resource in this manifest.

## Webview files and resource navigation

Declare each host call on the view body:

```ts
const imports = defineView({
  id: "imports",
  title: "Imports",
  body: {
    kind: "webview",
    entry: packageAsset("./src/imports.ts", import.meta.url),
    capabilities: ["files.upload", "files.list", "files.delete", "resource.open"],
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

    await host.call("resource.open", {
      resource: { type: "ticket", id: uploaded.id, label: uploaded.name },
      open: "preview",
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

This example opens the `ticket` kind the page above binds, so the active page places it.
A kind the host presents itself opens through its presenter instead.
