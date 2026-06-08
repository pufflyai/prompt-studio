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
| `routes`, `views`, `treeItems`                    | Dashboard pages, panels, and navigation entries.                                  |
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
- `workspaceEvents.created`, `archived`, `deleted`
- `worktreeEvents.created`, `removed`
- `gitEvents.committed`, `rebased`, `merged`, `conflicted`

Use `commandEvent(commandRef, "completed")` to react to command lifecycle events. Hooks observe events; they do not
cancel the operation that emitted the event.

## Package Assets

Use `packageAsset("./relative/path", import.meta.url)` for all shipped files and directories. Asset paths must resolve
inside the extension package. Skill assets may point at a directory containing `SKILL.md` plus support files.

## Webviews

Routes, views, settings panels, and renderers point at webview entries with `packageAsset()`. Declare only the
capabilities the webview needs, such as `commands.execute`, `resource.open`, `notification.show`, `preferences.get`,
and `preferences.set`.

Webview modules export `defineExtensionView({ render })` from `@pstdio/sdk/extensions`.
