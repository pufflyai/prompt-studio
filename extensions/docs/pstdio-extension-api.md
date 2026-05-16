# Prompt Studio Extension API

Prompt Studio extensions are local source packages under `~/.pstdio/extensions/<install-name>/`. Each package has two parts:

- `package.json` declares identity, version, host compatibility, and the entry file.
- `extension.ts` exports typed contributions with `defineExtension()`.

Identity is not declared in code. The runtime reads package identity before importing the entry module, so broken extension code can still appear in dashboard/API lists with package metadata and diagnostics.

## Package Manifest

Every extension package must include a `package.json` next to its entry file.

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
  }
}
```

Required fields:

- `name`: package name and project-facing scope, matching `^[a-z][a-z0-9-]*$`.
- `version`: extension package semver.
- `publisher`: publisher id segment, matching `^[a-z][a-z0-9-]*$`.
- `main`: relative path to the extension entry file inside the package.
- `engines.pstdio`: supported Prompt Studio extension API semver range.

Optional fields:

- `displayName`: dashboard display name. Falls back to `name`.
- `description`: dashboard/catalog description.

Derived fields:

- Extension id is always `${publisher}.${name}`.
- Command ids, CLI paths, artifact paths, themes, templates, and skills are scoped by package `name`.

Invalid packages produce diagnostics from `pstdio extensions check`. Missing manifest fields, invalid `main`, unsupported `engines.pstdio`, and entry import failures are reported with the package path.

## Source Layout

```txt
~/.pstdio/extensions/planner/
  package.json
  extension.ts
  README.md
  templates/
  skills/
  webviews/
```

`PSTDIO_HOME` may override `~/.pstdio`.

Extensions are toggled on or off per project. The source is shared. If one project needs a customized variant, copy the extension folder, change `package.json#name` so the derived id is distinct, modify it, and enable that copy for the project.

## Entry Module

The entry file exports contributions only.

```ts
import { defineExtension, packageAsset, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  settings: {
    defaultStatus: params.text({ label: "Default status", defaultValue: "backlog" }),
  },

  commands: {
    "tickets.create": {
      title: "Create ticket",
      cli: true,
      params: {
        title: params.text({ label: "Title" }),
      },
      async run(ctx) {
        return { created: true, title: ctx.params.title };
      },
    },
  },

  middlewares: {},
  hooks: {},
  schedules: {},
  navigation: {},
  views: {},
  routes: {},
  settingsPanels: {},
  activityRenderers: {},
  sessionAnchorRenderers: {},
  artifactMounts: {},
  templates: {},
  skills: {},
  themes: {},
  fileIconThemes: {},

  initialSetup: async () => {},
  migrate: async () => {},
});
```

Do not include `id`, `name`, `namespace`, `version`, `description`, or `apiVersion` in `defineExtension()`. TypeScript rejects identity fields on the contribution object.

## IDs And Scopes

For the package above:

```txt
package name     planner
publisher        pstdio
extension id     pstdio.planner
command id       planner.tickets.create
CLI path         pstdio planner tickets create
artifact root    <repo>/.pstdio/planner/
theme id         planner.<theme-key>
template id      planner.<template-key>
skill id         planner.<skill-key>
```

The old `namespace` concept is removed. Use the package `name` anywhere extension-facing code needs a short project scope.

## Commands

Commands are executable operations used by the CLI, dashboard menus, command palette, schedules, automations, and other commands.

```ts
export default defineExtension({
  commands: {
    publish: {
      title: "Publish release",
      description: "Create release notes and run the publish workflow.",
      cli: true,
      params: {
        version: params.text({ label: "Version" }),
      },
      async run(ctx) {
        return { ok: true, version: ctx.params.version };
      },
    },
  },
});
```

Command outcomes must be transport-safe:

```ts
type CommandOutcome<T = unknown> =
  | { ok: true; status: "success"; value: T }
  | { ok: false; status: "rejected"; code?: string; reason: string }
  | { ok: false; status: "error"; code?: string; reason: string; error?: SerializedError };
```

## Middlewares And Hooks

Middleware attaches to a command and runs before the command handler. It can continue, patch params, replace invocation data, or reject the command.

```ts
export default defineExtension({
  middlewares: {
    requireTitle: {
      commandId: "planner.tickets.create",
      async handler(ctx) {
        if (!ctx.params.title) {
          return ctx.commands.reject({ code: "missing_title", reason: "Title is required" });
        }
      },
    },
  },
});
```

Hooks observe emitted events. They cannot mutate or veto the command that emitted the event.

```ts
export default defineExtension({
  hooks: {
    recordCreatedTicket: {
      eventId: "planner.ticket.created",
      async handler(ctx) {
        await ctx.storage.set("lastTicketId", ctx.event.ticketId);
      },
    },
  },
});
```

## Package Assets

Use `packageAsset()` for files shipped inside the extension package.

```ts
export default defineExtension({
  templates: {
    ticket: {
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/ticket.md", import.meta.url),
    },
  },
  routes: {
    planner: {
      path: "planner",
      label: "Planner",
      webview: { entry: packageAsset("./webviews/planner.tsx", import.meta.url) },
    },
  },
});
```

Package asset paths must be relative and stay inside the package.

## Artifact Mounts And Storage

Artifact mounts are constrained to the package-name root under each repo:

```txt
<repo>/.pstdio/<package-name>/...
```

For package `planner`, the default scoped root is:

```txt
<repo>/.pstdio/planner/
```

Extension storage is API-owned and scoped by extension instance. Project-owned storage also carries the project id.

## Appearance Contributions

Themes and file icon themes are scoped by package `name`.

```ts
export default defineExtension({
  themes: {
    monokai: {
      title: "Monokai",
      format: "vscode-color-theme",
      mode: "dark",
      source: packageAsset("./themes/monokai.json", import.meta.url),
    },
  },
});
```

The theme id is `planner.monokai` for package `planner`.

## Diagnostics

Diagnostics should include the extension id when known, the source path, and project/repo context where relevant. If the entry module fails to import, the package still loads with empty contributions and an `extension_import_failed` diagnostic so the dashboard can show the package identity and error.
