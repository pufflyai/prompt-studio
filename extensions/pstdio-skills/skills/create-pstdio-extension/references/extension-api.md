# Prompt Studio extension API

## Package manifest

Every extension package needs a `package.json` next to its entry file:

```json
{
  "name": "planner",
  "version": "0.1.0",
  "displayName": "Planner",
  "description": "Planner workflow extension.",
  "publisher": "pstdio",
  "main": "./extension.ts",
  "engines": {
    "pstdio": "1.0.0-alpha.10"
  },
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pstdio/sdk": "latest"
  }
}
```

Set `pstdio.repoFiles.tracked` when the extension uses its allocated repo directory. It defaults to false.

Required fields are `name`, `version`, `publisher`, `main`, and `engines.pstdio`. The extension id is derived as
`${publisher}.${name}`. Keep the package `name` lowercase kebab-case because it scopes command ids, catalog names,
artifact roots, themes, and CLI paths.

## Entry module

`extension.ts` should only export contributions:

```ts
import { defineTemplate } from "@pstdio/sdk/extensions";
import { defineCommand, defineExtension, packageAsset, params } from "@pstdio/sdk/extensions";

const createTicket = defineCommand({
  id: "tickets.create",
  title: "Create ticket",
  cli: true,
  palette: [{ label: "Create ticket" }],
  params: { title: params.text({ label: "Title", required: true }) },
  async run(_ctx, commandParams) {
    return { title: commandParams.title };
  },
});

export default defineExtension({
  settings: {
    properties: { defaultStatus: { type: "string", title: "Default status", scope: "project", default: "backlog" } },
  },

  commands: [createTicket],

  templates: [
    defineTemplate({
      id: "ticket",
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/ticket.md", import.meta.url),
    }),
  ],
});
```

Do not include `id`, `name`, `namespace`, `version`, `description`, or `apiVersion` in `defineExtension()`.

## Derived IDs

For package name `planner`:

```txt
extension id     pstdio.planner
local command id tickets.create
runtime id       pstdio.planner.command.tickets.create
CLI path         pst planner tickets create
artifact root    <repo>/.pstdio/extension-storage/planner/
template id      planner.ticket
skill id         planner.create-guide
theme id         planner.monokai
```

Local ids must use lowercase kebab-case segments separated by dots (e.g. `ticket-status.create`). `pst extensions check` reports any other form as an error.

Catalog display names are derived from contribution keys by converting spaces and dots to kebab-case. Historical
camelCase and snake_case keys such as `createPstdioExtension` were normalized the same way; those forms are now
rejected by `pst extensions check`.

## Contribution types

| Type                                              | Use case                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `commands`                                        | User-triggered or automation-triggered operations.                                |
| `middlewares`                                     | Validate, reject, patch params, or replace invocation data before a command runs. |
| `hooks`                                           | React to emitted events without vetoing the original operation.                   |
| `schedules`                                       | Run a command on a cron expression.                                               |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets.                                                          |
| `templateTypes`                                   | Add a custom template category.                                                   |
| `views`, `viewMenus`                              | Reusable UI bodies and menus owned by a view.                                      |
| `pages`, `navigationItems`, `navigationTrees`     | Routed screens and explicit navigation.                                           |
| `placements`                                      | Mode-wide views and resource bindings outside pages.                              |
| `resourceKinds`                                   | Domain resource identity, labels, icons, and menus.                               |
| `modes`                                           | Typed Workbench modes referenced by placements.                                   |
| `statusBarItems`                                  | View references rendered outside docked layout.                                   |
| `statuses`                                        | Workflow status providers shared by boards and settings.                          |
| `resourceHierarchyProviders`                      | Domain parent lookup for resources. Page targets supply breadcrumb destinations.                  |
| `settingsPanels`                                  | References from host settings slots to views.                                     |
| `activityItems`                                   | Activity-rail entries that select a Workbench mode.                               |
| `artifactMounts`                                  | Safe file access under `.pstdio/extension-storage/<package-name>/`.                                 |
| `workspaceTypes`, `harnesses`                     | Advanced provider integrations.                                                   |

Editable template types must declare `list`, `read`, `save`, and `delete` command refs. The dashboard invokes those commands and never reads template storage directly. Store user overrides in `ctx.storage`; read packaged defaults with `ctx.packageFiles`.

The commands exchange `{ name, title, type }` summaries and `{ name, title, type, content }` content values. Read and delete accept `{ name }`. Save accepts `{ name, title?, type, content }`.

## Host capability validation

`pst extensions check` validates declared dashboard UI surfaces against the dashboard build that will load them. Contract-valid extensions can still fail if the host does not advertise the bridge for a surface. The diagnostic code is `extension_host_capability_missing`; its metadata includes `contributionId`, `missingCapability`, `hostVersion`, and `requiredSince` when known.

If no host descriptor is available, the check reports `hostCompatibility.status: "unverified"`. This means the extension contract was checked, but dashboard bridge support was not proven.

Current dashboard capability names:

| Capability | Surface |
| --- | --- |
| `command.v1` | Dashboard command execution. |
| `menu.v1` | Menu command entries. |
| `command-palette.v1` | Command palette entries. |
| `mode.v1` | Workbench modes and resource layouts. |
| `view.webview.v1` | Webview bodies. |
| `view.tree.v1` | Tree bodies. |
| `view.file.v1` | File bodies. |
| `view.controls.v1` | Controls bodies and menus. |
| `view.kanban.v1` | Kanban bodies. |
| `view.data-table.v1` | Data table bodies. |
| `page.v1` | Routed pages with owned view and resource-bound slots. |
| `placement.v1` | Mode-wide docked view and resource bindings. |
| `navigation-item.v1` | Fixed host navigation items. |
| `navigation-tree.v1` | Page- or mode-owned tree sections. |
| `status-bar-item.v1` | Views placed in the status bar. |
| `status.v1` | Workflow status providers. |
| `settings.section.v1` | Settings navigation sections. |
| `settings.panel.v1` | Settings placements that reference views. |
| `settings.definition.v1` | Extension setting definitions. |
| `renderer.command-palette-resource.v1` | Command palette resource providers. |
| `keybinding.v1` | Dashboard keybindings. |
| `resource-hierarchy.v1` | Resource hierarchy from native renderers. |

## Commands and params

Commands can be exposed to the CLI with `cli: true` or `cli: { path, description, examples }`. Add dashboard entry
points with `menus` and a host-owned workbench target such as `workbench.nav.actions` or
`workbench.nav.overflow`. Add command palette entries explicitly with `palette`.

Available param builders include `params.text`, `params.longText`, `params.number`, `params.boolean`,
`params.select`, `params.multiSelect`, `params.repo`, `params.harness`, `params.resource`, and
`params.json`.

Command params are the handler's second argument. `ctx` in a command includes:

- `projectId`, `workspaceId`, `project`, `extensionId`, `name`, `repo`, `source`, and `resource`
- `commandId`, `invocationId`, `signal`, `invocation`, `attachment`, and `slot`
- `attachment` for host-owned workbench invocations, including the target, mode, project, and active resource
- `storage`, `artifacts`, `files`, read-only `packageFiles`, and repo-scoped `extensionFiles`
- `repoFiles`, `workspaceFiles`, `skills`, `sessions`, `workspaces`, and `repos`
- `commands`, `events`, `activity`, `notify`
- `process`, optional `terminal`, `net`, `connections`, `logger`, and `settings`

Harness handlers also receive host-wide, extension-scoped `state`. See `host-storage-and-workspaces.md` for storage and workspace recipes.

Return transport-safe JSON values from commands. To reject before a command runs, use middleware and
`ctx.commands.reject({ code, reason })`.

## Middlewares

Reference a command with a typed `CommandRef` or a string `commandId`.

Middleware may return:

- nothing or `ctx.commands.continue()`
- `ctx.commands.patchParams({ ... })`
- `ctx.commands.replaceParams({ ... })`
- `ctx.commands.replaceInvocation({ ... })`
- `ctx.commands.reject({ code, reason })`

## Hooks and events

Use kernel event refs from `@pstdio/sdk/extensions` when possible:

- `projectEvents.opened`
- `sessionEvents.started`, `resumed`, `awaitingInput`, `succeeded`, `failed`, `completed`
- `workspaceEvents.created`, `provision` (awaited), `ready`, `archived`, `deleted`
- `worktreeEvents.removed`
- `gitEvents.committed`, `rebased`, `merged`, `conflicted`

Use `commandEvent(commandRef, "completed")` to react to command lifecycle events. Hooks observe events; they do not
cancel the operation that emitted the event.

## Package assets

Use `packageAsset("./relative/path", import.meta.url)` for all shipped files and directories. Asset paths must resolve
inside the extension package. Skill assets may point at a directory containing `SKILL.md` plus support files.

## Webviews

A view with `body.kind: "webview"` points at an entry with `packageAsset()`. Declare only the capabilities the
webview needs, such as `commands.execute`, `navigation.open`, `notification.show`, `preferences.get`, and
`preferences.set`. Settings panels and status-bar items reference that view instead of declaring another body.

Webview modules export `defineExtensionView({ render })` from `@pstdio/sdk/extensions`.

A webview can read files from an artifact mount its extension defines. Declare one grant per mount with
`artifactsRead(mount)`; there is no wildcard grant. A mount's `path` is relative to the extension's
package-name root in the repo's extension storage directory (`<repo>/.pstdio/extension-storage/<package-name>/<path>/`); its `id` only names the
mount in refs and grants and never changes the disk path.

```ts
const runArtifacts = defineArtifactMount({ id: "runs", path: "runs", label: "Runs" });

const report = defineView({
  id: "report",
  title: "Report",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/report.tsx", import.meta.url),
    capabilities: ["commands.execute", artifactsRead(runArtifacts)],
  },
});
```

The typed client then exposes `client.artifacts.list(mount, prefix?)`, `client.artifacts.readText(mount, path)`,
and `client.artifacts.imageUrl(mount, path)`, which returns a short-lived URL for png, jpeg, webp, or gif
images. The host enforces the boundary: undeclared mounts are denied by the bridge, path traversal and
symlink escapes are rejected, text reads over 5 MB and images over 20 MB return limit errors, and other
media types are refused. `pst extensions check` fails a webview that declares `artifacts.read` on a mount
its extension does not define.

Webviews store extension-owned files through the `files` object passed to
`defineExtensionView({ render })`. Declare `files.upload`, `files.list`, and
`files.delete` separately. `files.pick()` is browser-local and needs no declaration.

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

```ts
const [selected] = await files.pick({ accept: ".csv,text/csv" });
if (selected) {
  const uploaded = await files.upload({
    name: selected.name,
    data: await selected.arrayBuffer(),
    mimeType: selected.type || "text/csv",
  });
  const projectFiles = await files.list();
  await files.delete(uploaded.id);
}
```

Omitting `scope` uses project scope. Pass `{ type: "repo", id: repoId }`,
`{ type: "resource", id: resource.id }`, or an extension-defined `{ type, id }` to
upload and list another group. Commands address those scopes with different runtime
shapes:

```ts
ctx.storage.scope({ type: "repo", repoId }).files;
ctx.storage.scope({ type: "resource", resource }).files;
ctx.storage.scope({ type: "import", id: importId }).files;
```

`resource` is the full resource reference with at least `type` and `id`.
Extension-defined command scopes require an id. The host fixes the project and extension
instance owner. Global settings webviews do not get host-backed file methods because
they have no project owner. The upload limit is 25 MiB.

Declare `navigation.open` to open an explicit page or panel target:

```ts
await host.call("navigation.open", {
  target: {
    kind: "page",
    page: ticketPage.ref,
    resource: { type: "ticket", id: "PS-260", label: "Dashboard webview capabilities" },
  },
});
```

The target chooses the screen. The host never guesses a page or panel from the resource kind.

## Pages and navigation

A page owns its route and declares an optional resource constraint separately from Main presentation. Main shows a view or peer panels with an empty view. Extra slots and mode placements share the same static-view or resource-binding item.

Use the compiled [Scribble](examples/scribble.ts), [Zipline](examples/zipline.ts), and [Pigeon](examples/pigeon.ts) modules for declarations. Read [pages and panels](pages.md) for cardinality, shared mode panels, resource identity, and closing.

Navigation items and trees belong to a mode or page. Omitted mode chrome keeps the host sidebar in custom modes. A replacement view or false overrides it. Page navigation owns browser history; panel navigation preserves location. Compounds accept only page and panel steps.

## Native resource views

Use native view bodies when the host should own the editor or tree chrome instead of loading a custom
webview. Views own their body only. A page declares its routed resource and Main presentation separately. Extra page slots and mode placements use the same resource binding for their own instances.

File view bodies need a `load` callback; an optional `save` callback makes text content editable.
Load callbacks return `{ content }` for markdown/code text, `{ dataUrl }` for images, plus optional `fileName`,
`mimeType`, and `placeholder`. Images are always read-only.

The host picks the editor from `fileName` and `mimeType`: Markdown opens in the rich Markdown editor, other
text opens in the Monaco code editor, and a result without a `fileName` falls back to the Markdown editor.
Return `textRenderer: "monaco"` to force the code editor for a file the host would open as Markdown.

The rich Markdown editor preserves source outside the syntax the user edits. Prompts, templates, configuration
files, and other machine-read Markdown need no renderer override. Use `textRenderer: "monaco"` only when the user
should edit raw Markdown in the code editor.

Tree view bodies need a `body` callback; `children` and `footer` callbacks are optional. Body callbacks
return `TreeViewSection[]`. Children and footer callbacks return `TreeNode[]`.

### Refresh native renderers with events

Every native renderer can declare `refreshEvents`. Use a typed `eventRef()` for events owned by the extension, or a
string id for an event owned by another extension. Emit the event only after the mutation succeeds. The host reruns
only renderer callbacks that declared that event; it does not refresh renderers after unrelated commands.

```ts
import { defineCommand } from "@pstdio/sdk/extensions";
import { defineExtension, defineView, eventRef } from "@pstdio/sdk/extensions";

const ticketsChanged = eventRef<{ ticketId: string }>({ extensionId: "example.tickets", id: "changed" });

const tickets = defineView({
  id: "tickets",
  title: "Tickets",
  body: {
    kind: "dataTable",
    query: async () => ({ rows: [] }),
    refreshEvents: [ticketsChanged],
  },
});

export default defineExtension({
  views: [tickets],
  commands: [
    defineCommand({
      id: "update-ticket",
      title: "Update ticket",
      async run(ctx, _commandParams) {
        // Persist the update first.
        await ctx.events.emit(ticketsChanged, { ticketId: "ticket-1" });
      },
    }),
  ],
});
```

## Project navigation UI

For a Planner-style list or board, define a view with `body.kind: "kanban"` and a
`query` callback. Use the view as the page's Main presentation. Add a `navigationItems`
contribution whose action targets that page. Paths belong to pages, never views. The page selects its
declared mode; navigation never switches a mode as a separate step.

For an editable inspector, define a `controls` view with a `query` callback plus optional
`onValueChange`, `onApply`, and `onReset` callbacks. Attach it to an owner with
`defineViewMenu({ owner: owner.ref, view: inspector.ref, side: "right" })`. Bind resource
views through page slots, and keep mode-wide region choices in `placements`. Omitting both
`onValueChange` and `onApply` makes controls read-only. Callback payloads must be JSON.
Commit file metadata or data URLs, never live `File` objects.

## Harnesses

A harness contributes an agent that drives sessions. The host injects an event sink (and, for providers with the
`Approvals` capability, an approval channel) and owns the session lifecycle: timeouts, persistence, and status
transitions are keyed off the returned `HarnessSession`. Ids are namespaced as
`${publisher}.${package-name}.${provider.id}` (for example `pstdio.harness-claude-code.harness.claude-code`).

```ts
import { defineExtension, defineHarness, l10n } from "@pstdio/sdk/extensions";
import type { HarnessProvider, HarnessSession } from "@pstdio/sdk/extensions";

// Implement these process adapters for your agent. See harness-codex for a complete provider.
declare const runAgent: (
  ctx: Parameters<HarnessProvider["start"]>[0],
  input: Parameters<HarnessProvider["start"]>[1],
) => HarnessSession["done"];
declare const abort: () => void;
declare const resumeAgent: NonNullable<HarnessProvider["resume"]>;

const myAgent = defineHarness({
  id: "my-agent",
  label: l10n("harness.myAgent", "My Agent"),
  capabilities: () => ["ContextUsage"],
  detect: async (ctx) => {
    const result = await ctx.process.run({ command: ["my-agent", "--version"] });
    return result.exitCode === 0 ? { available: true, version: result.stdout.trim() } : { available: false };
  },
  listModels: () => [{ id: "my-model" }],
  start: (ctx, input): HarnessSession => {
    input.events.push({ op: "add", path: "/messages/0", value: { id: "m0", role: "user", parts: [] } });
    return { agentSessionId: input.sessionId, done: runAgent(ctx, input), stop: () => abort() };
  },
  resume: (ctx, input) => resumeAgent(ctx, input),
});

export default defineExtension({ harnesses: [myAgent] });
```

- `start`/`resume` push `SessionMessage` JSON patches into `input.events` and return a `HarnessSession` whose `done`
  promise settles exactly once with `{ status: "completed" | "failed" | "cancelled" | "disconnected" }`.
- Set `timeoutStrategy: "provider"` only when the harness self-terminates; otherwise the host stops the session after
  a period without events.
- Implement `reattach` (and advertise `SessionReattach`) to re-bind orphaned provider sessions after a host restart.
- Consumers select a harness with `ctx.sessions.create({ harness: { harnessId, model } })` using the namespaced id.
