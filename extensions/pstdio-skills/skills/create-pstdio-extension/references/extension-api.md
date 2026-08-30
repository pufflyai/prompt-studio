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
    "pstdio": "1.0.0-alpha.6"
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
import {
  defineCommand,
  defineExtension,
  packageAsset,
  params,
} from "@pstdio/sdk/extensions";

const createTicket = defineCommand({
  id: "tickets.create",
  title: "Create ticket",
  cli: true,
  palette: { label: "Create ticket" },
  params: { title: params.text({ label: "Title", required: true }) },
  async run(_ctx, commandParams) {
    return { title: commandParams.title };
  },
});

export default defineExtension({
  settings: {
    defaultStatus: params.text({
      label: "Default status",
      defaultValue: "backlog",
    }),
  },

  commands: [createTicket],

  templates: {
    ticket: {
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/ticket.md", import.meta.url),
    },
  },
});
```

Do not include `id`, `name`, `namespace`, `version`, `description`, or `apiVersion` in `defineExtension()`.

## Derived IDs

For package name `planner`:

```txt
extension id     pstdio.planner
command id       planner.tickets.create
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
| `pages`                                           | Tool screens: slots per region with open policy, plus resource-kind bindings.      |
| `placements`, `navigationItems`                   | Static mode furniture and typed navigation actions.                               |
| `resourceKinds`                                   | Domain data (collections, palette entries, menu slots); no presentation.          |
| `modes`                                           | Typed Workbench modes referenced by placements.                                   |
| `statusBarItems`                                  | View references rendered outside docked layout.                                   |
| `statuses`                                        | Workflow status providers shared by boards and settings.                          |
| `resourceHierarchyProviders`                      | Parent lookup for resources, used for breadcrumbs and hierarchy.                  |
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
| `page.v1` | Page contributions: slots, bindings, and page navigation targets. |
| `placement.v1` | Docked static view placements. |
| `navigation-item.v1` | Fixed host navigation items. |
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

A view with `body.kind: "webview"` points at an entry with `packageAsset()`. Declare only the capabilities the webview needs, such as `commands.execute`, `resource.open`, `notification.show`, `preferences.get`, and `preferences.set`. The `resource.open` capability is an emission: it takes `{ resource, open? }` and the active page's bindings place the resource (`href` on the same capability opens an external link). Settings panels and status-bar items reference that view instead of declaring another body.

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

Declare `resource.open` to open an SDK resource in the workbench:

```ts
await host.call("resource.open", {
  resource: { type: "ticket", id: "PS-260", label: "Dashboard webview capabilities" },
  open: "preview",
});
```

Guests pass `{ type, id, label?, metadata? }` and leave URI creation to the host. A kind
the host presents itself (a workspace, a session) opens through its presenter; any other
kind is placed by the active page's bindings, so that page must bind it.

## Pages

A page is a tool screen declared in one contribution. It places content into the bench regions (`sidenav`, `main`, `secondary`, `side`) and receives opened resources. Tabs are derived from slot content; nothing about presentation is persisted.

```ts
const ticketsPage = definePage({
  id: "tickets",
  title: l10n("pages.tickets.title", "Tickets"),
  path: "tickets", // URL segment: /projects/{project}/{extension-id}/tickets
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
```

Slot rules:

- A slot is static (it names a `view`) or bound (no `view`; a binding fills it), never both.
- Bound slots only: `cardinality: "one"` (default) swaps each open in place; `"many"` stacks tabs. `many` needs a panel region (`main`, `side`, `secondary`).
- Static slots only: `defaultOpen: false` starts the slot closed until revealed; `scope: "page" | "location"` sets how long its view state lives (default `"page"`; `"location"` keys it to the page's active bound instance).
- `closable: false` protects a slot's tab while it has content.
- `follows: "<slot-id>"` on a one-cardinality bound slot tracks the active instance of the named `many` slot; the two slots must share a bound kind.
- At most one binding per (kind, slot); several kinds may share one `many` slot.

A page owns every region its slots declare while it is active; every other region keeps the mode's furniture. Static tabs are titled by the view, bound tabs by the open resource. Navigation targets pages, never resources:

```ts
action: { kind: "page", page: ticketsPage.ref }
return { navigate: { kind: "page", page: ticketsPage.ref, resource: ticketRef, open: "pin" } };
return { navigate: { kind: "page", page: ticketsPage.ref, slot: "files" } }; // reveal a closed slot
```

`open` is `"preview" | "pin"` (default preview) and only `many` slots care. A view inside the active page emits instead: a tree node or row with a `resource` and no target emits it on activation, and `onRowActivate` may return `{ resource, open?, section? }` (a `ResourceEmission`). The page's bindings place the emission; an emission for an already-open resource re-activates that instance. Renderers have no pin gesture; pinning is tab behavior (double-click a preview tab or its pin affordance) or `open: "pin"` on an explicit target.

Native screens are host pages published as `workbenchPages.*`: `workspaces` (binds `workspace`), `sessions` (binds `session`, `session-draft`), and `start`. Link them like any page: `{ kind: "page", page: workbenchPages.workspaces, resource: workspaceRef }`. Settings is not a page; open it by command. Mode switching is also a plain command: `{ kind: "command", target: { command: workbenchCommands.switchMode, params: { modeId: myMode.id } } }` with the mode's local id.

`pst extensions check` validates pages with the `extension_page_*` diagnostic codes listed in [validation.md](validation.md). The removed `resourceViews` contribution is rejected with `removed_extension_contribution`; declare a page with `bindings` instead.

## Native view bodies

Use native view bodies when the host should own the editor or tree chrome instead of loading a custom webview.

File view bodies need a `load` callback; an optional `save` callback makes text content editable.
Load callbacks return `{ content }` for markdown/code text, `{ dataUrl }` for images, plus optional `fileName`,
`mimeType`, and `placeholder`. Images are always read-only.

The host picks the editor from `fileName` and `mimeType`: Markdown opens in the rich Markdown editor, other
text opens in the Monaco code editor, and a result without a `fileName` falls back to the Markdown editor.
Return `textRenderer: "monaco"` to force the code editor for a file the host would open as Markdown.

**Warning:** the rich Markdown editor does not preserve source bytes. Saving re-serializes the whole document,
even when the user made no edit: characters gain escapes, tables are realigned, and whitespace changes. One
observed no-edit load and save grew a 62 KB Markdown file to 92 KB and added escape characters to
`{{token_with_underscores}}` placeholders. Return `textRenderer: "monaco"` for any Markdown file that another
tool reads back, such as prompts, templates, and configuration files.

Tree view bodies need a `body` callback; `children` and `footer` callbacks are optional. Body callbacks
return `TreeViewSection[]`. Children and footer callbacks return `TreeNode[]`.

### Refresh native renderers with events

Every native renderer can declare `refreshEvents`. Use a typed `eventRef()` for events owned by the extension, or a
string id for an event owned by another extension. Emit the event only after the mutation succeeds. The host reruns
only renderer callbacks that declared that event; it does not refresh renderers after unrelated commands.

```ts
import { defineExtension, defineView, eventRef } from "@pstdio/sdk/extensions";

const ticketsChanged = eventRef<{ ticketId: string }>("example.tickets.changed");

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
  commands: {
    updateTicket: {
      title: "Update ticket",
      async run(ctx, _commandParams) {
        // Persist the update first.
        await ctx.events.emit(ticketsChanged, { ticketId: "ticket-1" });
      },
    },
  },
});
```

## Project navigation UI

For a Planner-style list or board, define a view with `body.kind: "kanban"` and a
`query` callback, put it in a page slot (usually static and unclosable in `main`),
and add a `navigationItems` contribution whose typed action targets the page ref.
A webview screen uses the same model with `body.kind: "webview"`. The page's
`path` is the screen's URL under the extension's namespace.

To navigate to a Workbench mode instead of a view, use a `kind: "command"` action with the typed
`workbenchCommands.switchMode` ref from `@pstdio/sdk/extensions`:

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

`modeId` is the full Workbench mode id: `"project"` or `"settings"` for host modes, or the normalized id of
an extension mode. Copy an extension mode's normalized id from `pst extensions check` output or from the
extension's contributions tab in project settings. Never hand-build `pstdio.<extension>.mode.<id>` strings,
and never hand-type the raw `workbench.action.switchMode` command id; always use the typed ref. Activity
items use the same command with `command` and `params` as sibling fields instead of a nested `target`.

For an editable inspector, define a `controls` view with a `query` callback plus optional
`onValueChange`, `onApply`, and `onReset` callbacks. Attach it to an owner with
`defineViewMenu({ owner: owner.ref, view: inspector.ref, side: "right" })`; it
follows the owner into every tab. Omitting both
`onValueChange` and `onApply` makes controls read-only. Callback payloads must be JSON.
Commit file metadata or data URLs, never live `File` objects.

## Harnesses

A harness contributes an agent that drives sessions. The host injects an event sink (and, for providers with the
`Approvals` capability, an approval channel) and owns the session lifecycle: timeouts, persistence, and status
transitions are keyed off the returned `HarnessSession`. Ids are namespaced as
`${publisher}.${package-name}.${provider.id}` (for example `pstdio.harness-claude-code.harness.claude-code`).

```ts
import { defineExtension, l10n } from "@pstdio/sdk/extensions";
import type { HarnessProvider, HarnessSession } from "@pstdio/sdk/extensions";

const myAgent: HarnessProvider = {
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
};

export default defineExtension({ harnesses: { myAgent } });
```

- `start`/`resume` push `SessionMessage` JSON patches into `input.events` and return a `HarnessSession` whose `done`
  promise settles exactly once with `{ status: "completed" | "failed" | "cancelled" | "disconnected" }`.
- Set `timeoutStrategy: "provider"` only when the harness self-terminates; otherwise the host stops the session after
  a period without events.
- Implement `reattach` (and advertise `SessionReattach`) to re-bind orphaned provider sessions after a host restart.
- Consumers select a harness with `ctx.sessions.create({ harness: { harnessId, model } })` using the namespaced id.
