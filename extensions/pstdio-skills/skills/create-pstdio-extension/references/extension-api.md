# Prompt Studio Extension API

## Package Manifest

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
    "pstdio": "^1.0.0"
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

## Entry Module

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
      async run(ctx) {
        return { title: ctx.params.title };
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

## Contribution Surfaces

| Surface                                           | Use case                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `commands`                                        | User-triggered or automation-triggered operations.                                |
| `middlewares`                                     | Validate, reject, patch params, or replace invocation data before a command runs. |
| `hooks`                                           | React to emitted events without vetoing the original operation.                   |
| `schedules`                                       | Run a command on a cron expression.                                               |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets.                                                          |
| `templateTypes`                                   | Add a custom template category.                                                   |
| `routes`, `panels`, `treeItems`                   | Custom webview pages, Workbench Panels, and route or command navigation entries.  |
| `kanbanRenderers`                                 | Native dashboard data surfaces; each renderer gets a project-sidenav entry.       |
| `fileRenderers`                                   | Native markdown, code, and image document content for resources.                  |
| `treeRenderers`                                   | Native workbench tree panels for resources, outlines, and navigation.             |
| `controlsRenderers`                               | Reusable inspector/property renderers (ParamEditor, command-backed), placed by a view. |
| `settingsPanels`                                  | Dashboard configuration UI.                                                       |
| `activityRenderers`, `sessionAnchorRenderers`     | Custom dashboard renderers.                                                       |
| `artifactMounts`                                  | Safe file access under `.pstdio/<package-name>/`.                                 |
| `workspaceTypes`, `harnesses`                     | Advanced provider integrations.                                                   |
| `initialSetup`, `migrate`                         | Install-time and upgrade-time lifecycle work.                                     |

## Commands And Params

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

## Hooks And Events

Use kernel event refs from `@pstdio/sdk/extensions` when possible:

- `projectEvents.opened`
- `sessionEvents.started`, `resumed`, `awaitingInput`, `succeeded`, `failed`, `completed`
- `workspaceEvents.created`, `provision` (awaited), `ready`, `archived`, `deleted`
- `worktreeEvents.removed`
- `gitEvents.committed`, `rebased`, `merged`, `conflicted`

Use `commandEvent(commandRef, "completed")` to react to command lifecycle events. Hooks observe events; they do not
cancel the operation that emitted the event.

## Package Assets

Use `packageAsset("./relative/path", import.meta.url)` for all shipped files and directories. Asset paths must resolve
inside the extension package. Skill assets may point at a directory containing `SKILL.md` plus support files.

## Webviews

Routes, Panels, settings panels, and renderers point at webview entries with `packageAsset()`. Declare only the
capabilities the webview needs, such as `commands.execute`, `resource.open`, `notification.show`, `preferences.get`,
and `preferences.set`.

Webview modules export `defineExtensionView({ render })` from `@pstdio/sdk/extensions`.

## Native Resource Views

Use native renderers when the host should own the editor or tree chrome instead of loading a custom webview. A native
resource detail screen usually has:

- A `modes` contribution with `resourceKind` and a `layout.open` entry that pins supporting Panels.
- A `fileRenderers` contribution for the main document/file content.
- A `treeRenderers` contribution for side-panel navigation or file lists.
- `panels` that bind the mode/resource to those renderers.

Each view must declare exactly one of `webview`, `treeRenderer`, or `fileRenderer`. A view needs a `target`, `slot`,
`resourceKind`, or a reference from a mode layout so the host can reach it. For resource detail screens, set
`resourceKind` on the editor and auxiliary Panels, then let `modes.<mode>.layout.open` pin Panels such as the tree.

`fileRenderers` need `title` and a valid `loadCommand`; `saveCommand` is optional and makes text content editable.
Load commands return `{ content }` for markdown/code text, `{ dataUrl }` for images, plus optional `fileName`,
`mimeType`, and `placeholder`. Images are always read-only.

`treeRenderers` need `title` and a valid `bodyCommand`; `childrenCommand` and `footerCommand` are optional. Body
commands return `TreeViewSection[]`. Children and footer commands return `TreeNode[]`.

## Project Sidenav UI

For a Planner-style native list or board, define a `kanbanRenderers` contribution with a query command. The dashboard
creates the project-sidenav entry from the kanban renderer; do not add a `treeItems` contribution with
`action.kind === "kanbanRenderer"` because the resource-first dashboard ignores those tree-item actions.

For a custom webview page, define a `routes` contribution and add a `treeItems` contribution with
`action: { kind: "route", route: "<route-path>" }`. Use the route `path` value here, not the normalized route id.
Use this for custom webview pages only; native resource screens should use `modes`, `panels`, `fileRenderers`, and
`treeRenderers`.

For an editable inspector/property Panel, define a `controlsRenderers` renderer with a `queryCommand` (returns
`{ params?, groups?, values?, readOnly? }` for the ParamEditor) plus optional `updateValueCommand`, `applyCommand`,
and `resetCommand`. Nest the menu under its owning Panel:
`panelMenus: { properties: { title: "Properties", side: "right", controlsRenderer: "<id>" } }`.
The active owner instance determines when the menu is available, and it retains its attached or collapsed state.
The Panel companions its `resourceKind`; omitting both
`updateValueCommand` and `applyCommand` makes it read-only. Command payloads must be JSON — commit file metadata or
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
