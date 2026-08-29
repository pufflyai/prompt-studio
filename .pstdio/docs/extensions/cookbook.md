# Extension Cookbook

This cookbook gives short recipes for the implemented extension API.

## Create A Package

```txt
~/.pstdio/extensions/planner/
  package.json
  extension.ts
  templates/
  skills/
  webviews/
```

`package.json` owns identity:

```json
{
  "name": "planner",
  "version": "0.1.0",
  "publisher": "pstdio",
  "main": "./extension.ts",
  "engines": {
    "pstdio": "1.0.0-alpha.5"
  },
  "type": "module",
  "dependencies": {
    "@pstdio/sdk": "latest"
  }
}
```

## Add A CLI Command

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: {
    "tickets.create": {
      title: "Create ticket",
      cli: {
        path: ["tickets", "create"],
        examples: ['pst planner tickets create --title "Add review status"'],
      },
      params: {
        title: params.text({ label: "Title", required: true }),
      },
      async run(_ctx, commandParams) {
        return { title: commandParams.title };
      },
    },
  },
});
```

## Add A Resource Header Action

```ts
import {
  defineCommand,
  defineExtension,
  defineResourceKind,
  params,
  resourceMenuSlotRef,
} from "@pstdio/sdk/extensions";

const ticket = defineResourceKind({
  id: "ticket",
  surface: "primary",
  menuSlots: [
    { id: "headerActions", placement: "header-primary", access: "owner" },
  ],
});

const runAttempt = defineCommand({
  id: "run-attempt",
  title: "Run attempt",
  menus: [
    {
      slot: resourceMenuSlotRef(ticket.ref, "headerActions"),
      label: "Run attempt",
      icon: "play",
      presentation: "button",
    },
  ],
  params: {
    ticketId: params.text({ resolvedFrom: "resource" }),
  },
  async run(ctx) {
    return { ticket: ctx.resource?.id };
  },
});

export default defineExtension({
  resourceKinds: [ticket],
  commands: [runAttempt],
});
```

`resolvedFrom: "resource"` tells the host not to show that parameter in a command form. The command reads the active resource from `ctx.resource`.

## Add Middleware

Middleware runs before a command. Use it when the extension needs to validate, reject, or rewrite command invocation.

```ts
import { defineCommand, defineExtension, defineMiddleware, params } from "@pstdio/sdk/extensions";

const publishWorkspace = defineCommand({
  id: "publish-workspace",
  title: "Publish workspace",
  params: { workspaceId: params.text({ required: true }) },
  async run(_ctx, commandParams) {
    return { published: commandParams.workspaceId };
  },
});

const requirePassingChecks = defineMiddleware<{ workspaceId: string }>({
  id: "require-passing-checks",
  command: publishWorkspace.ref,
  async run(ctx, commandParams) {
    const workspace = await ctx.workspaces.get(commandParams.workspaceId);
    if (!workspace?.worktree_path) return ctx.commands.continue();
    const result = await ctx.process.run({ command: ["bun", "run", "test"], cwd: workspace.worktree_path });
    if (result.exitCode === 0) return ctx.commands.continue();
    return ctx.commands.reject({ code: "checks_failed", reason: "Tests must pass before publishing." });
  },
});

export default defineExtension({ commands: [publishWorkspace], middlewares: [requirePassingChecks] });
```

Middleware can return:

- `ctx.commands.continue()`
- `ctx.commands.patchParams({ ... })`
- `ctx.commands.replaceParams({ ... })`
- `ctx.commands.replaceInvocation({ ... })`
- `ctx.commands.reject({ code, reason })`
- nothing, which is treated as continue

## Add A Hook

Hooks observe emitted events. They do not veto the event or mutate the operation that emitted it.

```ts
import { defineExtension, sessionEvents } from "@pstdio/sdk/extensions";

export default defineExtension({
  hooks: {
    recordStartedSession: {
      event: sessionEvents.started,
      async handler(ctx, event) {
        await ctx.storage.set(
          `session:${event.sessionId}:started`,
          new Date().toISOString(),
        );
      },
    },
  },
});
```

Use hooks for follow-up automation such as worktree cleanup, session creation,
notifications, and activity records. Planner ticket workflow automation should
run through planner commands/storage rather than removed core ticket events.

## Observe Command Lifecycle

Use `commandEvent()` when a hook should react to a command outcome:

```ts
import {
  commandEvent,
  commandRef,
  defineExtension,
} from "@pstdio/sdk/extensions";

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "planner" });
const publishCommand = plannerCommand<{ version: string }, { published: boolean }>("publish");

export default defineExtension({
  commands: {
    publish: {
      title: "Publish",
      async run(_ctx, _commandParams) {
        return { published: true };
      },
    },
  },
  hooks: {
    recordPublishFailure: {
      event: commandEvent(publishCommand, "failed"),
      async handler(ctx, event) {
        await ctx.activity.record({
          message: `Publish failed: ${event.reason}`,
        });
      },
    },
  },
});
```

## Add A View And Navigation Item

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
    entry: packageAsset("./webviews/planner.tsx", import.meta.url),
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

The view has the normalized id `publisher.name.view.planner`. Its `path` adds a deep
link without creating another UI contribution. Use the returned `planner.ref` anywhere
the extension needs to target this view.

To make a navigation item switch Workbench modes instead of opening a view, use a `kind: "command"`
action with the typed `workbenchCommands.switchMode` ref:

```ts
import { defineNavigationItem, workbenchCommands, workbenchSlots } from "@pstdio/sdk/extensions";

defineNavigationItem({
  id: "lab",
  slot: workbenchSlots.projectNavigation,
  label: "Lab",
  icon: "flask-conical",
  action: {
    kind: "command",
    target: { command: workbenchCommands.switchMode, params: { modeId: "project" } },
  },
});
```

`modeId` takes a host mode id (`"project"`, `"settings"`) or an extension mode's normalized id. Copy the
normalized id from `pst extensions check` output or from the extension's contributions tab in project
settings. Do not hand-build `pstdio.<extension>.mode.<id>` strings, and do not hand-type the raw
`workbench.action.switchMode` command id.

## Call Commands From A Webview

Export the commands record and the settings contribution, then build a typed client in
the view. Type-only imports keep server code out of the webview bundle.

```ts
// src/commands/index.ts
import { defineCommand, params } from "@pstdio/sdk/extensions";

export const commands = {
  "ticketStatus.read": defineCommand({
    title: "Read ticket statuses",
    async run(_ctx, _commandParams) {
      return { statuses: [] as { id: string; name: string }[] };
    },
  }),
  "ticketStatus.create": defineCommand({
    title: "Create ticket status",
    params: { label: params.text({ required: true }) },
    async run(_ctx, commandParams) {
      return { id: commandParams.label };
    },
  }),
};
```

```tsx
// src/webviews/statuses.tsx
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";
import type { commands } from "../commands";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof commands>(host);

    const StatusList = () => {
      const statuses = useCommandQuery({
        queryKey: ["ticket-statuses"],
        command: client.commands["ticketStatus.read"],
      });
      const createStatus = useCommandMutation({
        command: client.commands["ticketStatus.create"],
        invalidate: [["ticket-statuses"]],
      });

      // render statuses.data and call createStatus.mutate({ label: "Todo" })
      return null;
    };

    // mount the React root with <StatusList /> under a QueryClientProvider
  },
});
```

Wrong param shapes, wrong result uses, and unknown command keys fail to compile. Pass
the settings contribution type as the second type argument for typed `client.settings`.

## Store files from a webview

Declare the file operations on the webview body. `pick` stays inside the browser, but
upload, list, and delete call the host and each needs its own declaration.

```ts
const imports = defineView({
  id: "imports",
  title: "Imports",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/imports.ts", import.meta.url),
    capabilities: ["files.upload", "files.list", "files.delete"],
  },
});
```

Use the `files` helper passed to `defineExtensionView`:

```ts
// src/webviews/imports.ts
import { defineExtensionView } from "@pstdio/sdk/extensions";

export default defineExtensionView({
  render({ files, mount }) {
    const button = document.createElement("button");
    button.textContent = "Import CSV";
    button.addEventListener("click", async () => {
      const [selected] = await files.pick({ accept: ".csv,text/csv" });
      if (!selected) return;

      const uploaded = await files.upload({
        name: selected.name,
        data: await selected.arrayBuffer(),
        mimeType: selected.type || "text/csv",
      });
      const stored = await files.list();
      button.textContent = `Stored ${uploaded.name}; ${stored.length} project files`;
    });
    mount.append(button);
    return () => button.remove();
  },
});
```

The default scope is the active project. Pass the same scope to upload and list when a
file belongs to a repository, resource, or extension-defined group:

```ts
const scope = { type: "resource", id: "PS-260" };
const uploaded = await files.upload({ name, data, mimeType, scope });
const resourceFiles = await files.list({ scope });
await files.delete(uploaded.id);
```

The host fixes ownership to the active project extension instance. The webview cannot
name a different owner. Project routes, panels, resource views, and project settings
views can use host-backed files. Global settings views cannot because they have no
project extension instance. Uploads larger than 25 MiB fail.

A command sees files from the same default project scope through `ctx.storage.files`:

```ts
const bytes = await ctx.storage.files.getBytes(params.fileId);
const text = new TextDecoder().decode(bytes);
```

Command scopes use runtime objects instead of the webview `{ type, id }` shape:

```ts
const repoFiles = ctx.storage.scope({ type: "repo", repoId }).files;
const resourceFiles = ctx.storage.scope({ type: "resource", resource }).files;
const importFiles = ctx.storage.scope({ type: "import", id: importId }).files;
```

`resource` must be the full resource reference with at least `type` and `id`, not only
the resource id. Extension-defined command scopes require an id. Read from the same
scope that the webview used for upload and list.

## Open a resource from a webview

Declare `resource.open`, then pass a resource reference to the host. The resource type
must match a resource kind that the workbench can render.

```ts
const results = defineView({
  id: "results",
  title: "Results",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/results.ts", import.meta.url),
    capabilities: ["resource.open"],
  },
});
```

```ts
await host.call("resource.open", {
  resource: {
    type: "ticket",
    id: "PS-260",
    label: "Dashboard webview capabilities",
    metadata: { status: "in-review" },
  },
  input: { strategy: "replace-active" },
});
```

Omit `input` for a persistent resource. Use `replace-active` when the new resource
should take the current resource's place. The host converts the SDK fields into the
workbench resource and creates its URI. Do not build a workbench URI in guest code. The
kind and one of its presenters must already be registered before the call.

## Read Artifacts From A Webview

Declare an artifact mount and grant the webview read access to it. Each `artifactsRead` declaration grants
one mount; there is no wildcard. The mount's `path` is relative to the extension's package-name root in the repo's
extension storage directory: for package `fds-playground`, the mount below resolves to
`<repo>/.pstdio/extension-storage/fds-playground/runs/`.
The `id` only names the mount in refs and grants; it never changes the disk path.

```ts
import { artifactsRead, defineArtifactMount, defineExtension, defineView, packageAsset } from "@pstdio/sdk/extensions";

const runArtifacts = defineArtifactMount({ id: "runs", path: "runs", label: "Runs" });

const report = defineView({
  id: "report",
  title: "Run report",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/report.tsx", import.meta.url),
    capabilities: [artifactsRead(runArtifacts)],
  },
});

export default defineExtension({ artifactMounts: [runArtifacts], views: [report] });
```

In the webview, the typed client reads metadata, text, and images without any custom command:

```ts
const files = await client.artifacts.list("runs", "2026-08-28-a/");
const summary = JSON.parse(await client.artifacts.readText("runs", "2026-08-28-a/summary.json"));
const chartUrl = await client.artifacts.imageUrl("runs", "2026-08-28-a/chart.png");
// <img src={chartUrl} /> — the URL is short-lived; request a fresh one when it expires.
```

The host enforces every limit: reads stay inside the declared mount (traversal and symlink escapes are
rejected), text reads over 5 MB and images over 20 MB return limit errors, and image URLs are minted only
for png, jpeg, webp, and gif. `pst extensions check` fails a webview that declares `artifacts.read` on a
mount its extension does not define.

## Compose A Resource Screen

Declare the resource kind and its slots. Bind views to slots with `resourceViews`, then place the slots in a mode.

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

const ticket = defineResourceKind({
  id: "ticket",
  surface: "primary",
  slots: [
    { id: "primary", cardinality: "one", access: "owner" },
    { id: "navigation", cardinality: "one", access: "public" },
  ],
});
const primary = resourceSlotRef(ticket.ref, "primary");
const navigation = resourceSlotRef(ticket.ref, "navigation");
const editor = defineView({
  id: "ticket-editor",
  title: "Ticket",
  body: { kind: "webview", entry: packageAsset("./webviews/ticket-editor.tsx", import.meta.url) },
});
const files = defineView({
  id: "ticket-files",
  title: "Files",
  body: { kind: "tree", body: async () => [] },
});

export default defineExtension({
  resourceKinds: [ticket],
  views: [editor, files],
  resourceViews: [
    defineResourceView({ id: "editor", resourceKind: ticket.ref, slot: primary, view: editor.ref }),
    defineResourceView({ id: "files", resourceKind: ticket.ref, slot: navigation, view: files.ref }),
  ],
  placements: [
    definePlacement({ id: "editor", mode: workbenchModes.project, item: { kind: "resource-slot", slot: primary }, region: "main", required: true }),
    definePlacement({ id: "files", mode: workbenchModes.project, item: { kind: "resource-slot", slot: navigation }, region: "sidenav", required: true }),
  ],
});
```

Another extension can bind its view to the public `navigation` slot by importing the typed
resource-kind and slot refs. Geometry remains in `placements`; the binding never decides a region.

## Keep File Bytes Intact In File Views

File view bodies (`body.kind: "file"`) open Markdown in the rich Markdown editor by default. That editor
does not preserve source bytes: saving re-serializes the whole document even when the user made no edit.
Characters gain escapes, tables are realigned, and whitespace changes. One observed no-edit load and save
grew a 62 KB Markdown file to 92 KB and added escape characters to `{{token_with_underscores}}`
placeholders.

Return `textRenderer: "monaco"` from `load` for any file that another tool reads back, such as prompts,
templates, and configuration files:

```ts
const spec = defineView({
  id: "spec",
  title: "Spec",
  body: {
    kind: "file",
    load: async (ctx, input) => ({
      fileName: "spec.md",
      content: await readSpec(ctx, input.renderer.resource),
      textRenderer: "monaco",
    }),
    save: (ctx, input) => writeSpec(ctx, input.content),
  },
});
```

## Add Packaged Assets

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  templates: {
    reviewPrompt: {
      title: "Review prompt",
      type: "ticket",
      source: packageAsset("./templates/review.md", import.meta.url),
    },
  },
  skills: {
    reviewer: {
      title: "Reviewer",
      source: packageAsset("./skills/reviewer", import.meta.url),
    },
  },
});
```

## Read Files Packaged With The Extension

`ctx.packageFiles` is read-only and scoped to the installed extension package. Paths cannot leave that package.

```ts
const guide = await ctx.packageFiles.readText("docs/guide.md");
const examples = await ctx.packageFiles.list("examples/**/*.json");
```

Files excluded from the installed package by its `.gitignore` are not available. Keep every runtime asset out of ignored paths.

## Store Private Repo Files

Declare `pstdio.repoFiles.tracked` in `package.json`, then use the extension-scoped mount:

```json
{ "pstdio": { "repoFiles": { "tracked": false } } }
```

```ts
await ctx.extensionFiles?.writeText("cache/index.json", JSON.stringify(index));
```

The host allocates `.pstdio/ext/<publisher>.<name>/` and keeps it out of git when `tracked` is false.

## Store Extension Data

Use `ctx.storage` for private structured data and blobs. Use a declared artifact mount for files users should see in the project repository.

```ts
const preferences = ctx.storage.collection<{ id: string; enabled: boolean }>("preferences");
await preferences.put("defaults", { id: "defaults", enabled: true });

const reports = ctx.artifacts.mount("reports");
await reports.writeText("latest/summary.md", "# Summary\n");
```

Artifact directories are created on the first write. Before then, `exists()` is false, `list()` is empty, and direct reads fail. Mounts stay under `.pstdio/<extension-name>/` and reject path escapes.

## Work With Repositories And Workspaces

- `ctx.repoFiles` reads and writes the invocation repository. It is absent when no repository is in scope.
- `ctx.workspaceFiles` reads and writes the active workspace. It is absent when no local workspace is in scope.
- `ctx.workspaces.removeWorktree(id)` removes a workspace worktree and branch without deleting the workspace record.
- `ctx.workspaces.delete(id)` deletes the workspace and performs its full provider cleanup.

Use `removeWorktree` for cleanup commands that must preserve workspace history:

```ts
const result = await ctx.workspaces.removeWorktree(workspaceId);
return { removed: result.removed };
```

## Validate An Extension

```bash
pst extensions check
bun run --cwd extensions/<name> typecheck
```

Inspect what the host actually loaded before clicking through the UI. The extension's contributions tab in
project settings lists every declared contribution and its diagnostics, even while the extension is
disabled. For scripted checks, the same data is served by
`GET /v1/projects/{projectId}/extensions/{instanceId}/contributions`.

If the dashboard layout looks stale after contribution changes, run the extension's layout reset command
from the command palette. It appears in the `Extensions` group as `Reset <extension> layout`
(command id `dashboard.extensions.resetLayout.<extension-id>`) and clears the persisted layout for that
extension only.

For repo validation after non-documentation changes, run:

```bash
bun run validate
```

When bundled runtime artifacts change, also run:

```bash
bun run --cwd scripts verify:packages
```
