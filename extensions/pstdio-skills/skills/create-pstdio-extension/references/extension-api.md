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
    "pstdio": "1.0.0-alpha.3"
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

Required fields are `name`, `version`, `publisher`, `main`, and `engines.pstdio`. The extension id is derived as
`${publisher}.${name}`. Keep the package `name` lowercase kebab-case because it scopes command ids, catalog names,
artifact roots, themes, and CLI paths.

## Entry module

`extension.ts` should only export contributions:

```ts
import {
  defineExtension,
  packageAsset,
  params,
} from "@pstdio/sdk/extensions";

export default defineExtension({
  settings: {
    defaultStatus: params.text({
      label: "Default status",
      defaultValue: "backlog",
    }),
  },

  commands: {
    "tickets.create": {
      title: "Create ticket",
      cli: true,
      palette: { label: "Create ticket" },
      params: {
        title: params.text({ label: "Title", required: true }),
      },
      async run(_ctx, commandParams) {
        return { title: commandParams.title };
      },
    },
  },

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
artifact root    <repo>/.pstdio/planner/
template id      planner.ticket
skill id         planner.createGuide
theme id         planner.monokai
```

Catalog display names are derived from contribution keys by converting camelCase, underscores, spaces, and dots to
kebab-case. For example `create_pstdio_extension` and `createPstdioExtension` become `create-pstdio-extension`.

## Contribution types

| Type                                              | Use case                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `commands`                                        | User-triggered or automation-triggered operations.                                |
| `middlewares`                                     | Validate, reject, patch params, or replace invocation data before a command runs. |
| `hooks`                                           | React to emitted events without vetoing the original operation.                   |
| `schedules`                                       | Run a command on a cron expression.                                               |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets.                                                          |
| `templateTypes`                                   | Add a custom template category.                                                   |
| `routes`, `panels`, `treeItems`                   | Custom webview pages, workbench panels, and navigation entries.                   |
| `resourceKinds`, `resourcePanels`                 | Domain resource types with named slots, and panel-to-slot bindings.               |
| `modes`                                           | Placement recipes that arrange slots and known panels for accepted resources.     |
| `statusItems`                                     | Status-surface chrome. Not a panel; takes no part in docked layout.               |
| `resourceHierarchyProviders`                      | Parent lookup for resources, used for breadcrumbs and hierarchy.                  |
| `kanbanRenderers`, `dataTableRenderers`           | Native dashboard data surfaces wrapped by panels.                                 |
| `fileRenderers`                                   | Native markdown, code, and image document content for resources.                  |
| `treeRenderers`                                   | Native workbench tree panels for resources, outlines, and navigation.             |
| `controlsRenderers`                               | Reusable callback-backed inspector/property renderers, wrapped by a panel.        |
| `settingsPanels`                                  | Dashboard configuration UI.                                                       |
| `activityItems`                                   | Activity-rail entries that select a Workbench mode.                               |
| `artifactMounts`                                  | Safe file access under `.pstdio/<package-name>/`.                                 |
| `workspaceTypes`, `harnesses`                     | Advanced provider integrations.                                                   |
| `initialSetup`, `migrate`                         | Install-time and upgrade-time lifecycle work.                                     |

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
| `panel.webview.v1` | Webview panel bodies. |
| `panel.tree-renderer.v1` | Tree renderer panel bodies. |
| `panel.file-renderer.v1` | File renderer panel bodies. |
| `panel.controls-renderer.v1` | Controls renderer panel bodies and menus. |
| `panel.data-table-renderer.v1` | Data table renderer panel bodies. |
| `route.webview.v1` | Webview routes. |
| `tree-item.v1` | Project sidenav tree items. |
| `settings.section.v1` | Settings navigation sections. |
| `settings.panel.webview.v1` | Settings webview panels. |
| `settings.definition.v1` | Extension setting definitions. |
| `renderer.kanban.v1` | Native kanban renderers. |
| `renderer.data-table.v1` | Native data table renderers. |
| `renderer.command-palette-resource.v1` | Command palette resource providers. |
| `renderer.tree.v1` | Native tree renderers. |
| `renderer.file.v1` | Native file renderers. |
| `renderer.controls.v1` | Native controls renderers. |
| `keybinding.v1` | Dashboard keybindings. |
| `resource-hierarchy.v1` | Resource hierarchy from native renderers. |
| `resource-view.v1` | Resource detail views. |

## Commands and params

Commands can be exposed to the CLI with `cli: true` or `cli: { path, description, examples }`. Add dashboard entry
points with `menus` and a host-owned workbench target such as `workbench.nav.actions` or
`workbench.nav.overflow`. Add command palette entries explicitly with `palette`.

Available param builders include `params.text`, `params.longText`, `params.number`, `params.boolean`,
`params.select`, `params.multiSelect`, `params.repo`, `params.harness`, `params.template`, `params.resource`, and
`params.json`.

`ctx` in a command includes:

- `projectId`, `extensionId`, `name`, `repo`, `source`, `resource`, `params`
- `attachment` for host-owned workbench invocations, including the target, mode, project, and active resource
- `storage`, `artifacts`, `files`
- `tickets`, `sessions`, `workspaces`, `worktrees`, `repos`
- `commands`, `events`, `activity`, `notify`
- `process`, `net`, `logger`, `settings`

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

Routes, panels, settings panels, status items, and renderers point at webview entries with `packageAsset()`. Declare only the
capabilities the webview needs, such as `commands.execute`, `resource.open`, `notification.show`, `preferences.get`,
and `preferences.set`.

Webview modules export `defineExtensionView({ render })` from `@pstdio/sdk/extensions`.

## Native resource views

Use native renderers when the host should own the editor or tree chrome instead of loading a custom webview. A native
resource detail screen usually has:

- A `resourceKinds` contribution that declares the resource's surface and named slots.
- A `fileRenderers` contribution for the main document/file content.
- A `treeRenderers` contribution for side-panel navigation or file lists.
- `panels` that wrap those renderers and declare `show` for resource kinds owned by the extension.
- `resourcePanels` entries only for panels contributed into another extension's slots.
- A `modes` contribution whose `resources` recipe accepts the resource and describes any placement changes.

Each panel must declare exactly one of `webview` or `renderer`. An optional `path` gives the panel's registered view
a project deep link. An owned placement uses `show` with a docked `region`
(`sidenav`, `main`, `secondary`, or `side`), optional `for`, `allowedRegions`, and `required`. A native renderer reference has a `kind` (`tree`,
`file`, `controls`, `dataTable`, or `kanban`) and the renderer contribution's local `id`. In the mode recipe, mark
the primary panel placement `required: true` so the host restores the editor whenever the mode-resource context activates.

`fileRenderers` need `title` and a `load` callback; an optional `save` callback makes text content editable.
Load callbacks return `{ content }` for markdown/code text, `{ dataUrl }` for images, plus optional `fileName`,
`mimeType`, and `placeholder`. Images are always read-only.

`treeRenderers` need `title` and a `body` callback; `children` and `footer` callbacks are optional. Body callbacks
return `TreeViewSection[]`. Children and footer callbacks return `TreeNode[]`.

### Refresh native renderers with events

Every native renderer can declare `refreshEvents`. Use a typed `eventRef()` for events owned by the extension, or a
string id for an event owned by another extension. Emit the event only after the mutation succeeds. The host reruns
only renderer callbacks that declared that event; it does not refresh renderers after unrelated commands.

```ts
const ticketsChanged = eventRef<{ ticketId: string }>("example.tickets.changed");

export default defineExtension({
  dataTableRenderers: {
    tickets: {
      title: "Tickets",
      query: async () => ({ rows: [] }),
      refreshEvents: [ticketsChanged],
    },
  },
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

## Project sidenav UI

For a Planner-style native list or board, define a `kanbanRenderers` contribution with a `query` callback. Add a
Panel with `renderer: { kind: "kanban", id: "<renderer-id>" }`. To show it in the project sidenav, add a `treeItems`
contribution whose action opens that Panel.

For a custom webview page, define a `routes` contribution and add a `treeItems` contribution with
`action: { kind: "view", viewId: "<package-name>.<route-key>" }`. Routes and panels register views under their
normalized contribution IDs. An optional route or panel `path` is only the deep-link path.
Use this for custom webview pages only; native resource screens should use `resourceKinds`, `resourcePanels`,
`modes`, `panels`, `fileRenderers`, and `treeRenderers`.

For an editable inspector/property panel, define a `controlsRenderers` renderer with a `query` callback (returns
`{ params?, groups?, values?, readOnly? }` for the ParamEditor) plus optional `onValueChange`, `onApply`, and `onReset`
callbacks. Nest the menu under its owning panel:
`panelMenus: { properties: { title: "Properties", side: "right", renderer: { kind: "controls", id: "<id>" } } }`.
The active owner instance determines when the menu is available, and it retains its attached or collapsed state.
Bind the owning panel to its resource kind with `show.for`; omitting both
`onValueChange` and `onApply` makes it read-only. Callback payloads must be JSON. Commit file metadata or
data URLs, never live `File` objects.

## Harnesses

A harness contributes an agent that drives sessions. The host injects an event sink (and, for providers with the
`Approvals` capability, an approval channel) and owns the session lifecycle: timeouts, persistence, and status
transitions are keyed off the returned `HarnessSession`. Ids are namespaced as
`${publisher}.${package-name}.${provider.id}` (for example `pstdio.harness-claude-code.claude-code`).

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
