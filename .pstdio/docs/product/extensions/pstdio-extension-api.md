# Prompt Studio Extension API

Prompt Studio extensions are local source packages under `~/.pstdio/extensions/<install-name>/` or `<repo>/.pstdio/extensions/<install-name>/`. Each package has two parts:

- `package.json` declares identity, version, host compatibility, and the entry file.
- `extension.ts` exports typed contributions with `defineExtension()`.

Identity is not declared in code. The runtime reads package identity before importing the entry module, so broken extension code can still appear in dashboard/API lists with package metadata and diagnostics.

## Documentation Set

- [Extensions overview](./index.md): product model, ownership boundaries, lifecycle, and authoring scope.
- [Dashboard UI attachments](./workbench-attachments.md): implemented target-based UI attachment model.
- [Extension modes](./modes-and-layout.md): current mode metadata support.
- [Extension cookbook](./cookbook.md): small authoring recipes for common extension tasks.

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
  },
  "pstdio": {
    "scope": "user"
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
- `pstdio.scope`: install/load scope, either `user` or `repo`. Defaults to `user`.

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

Packages under `$PSTDIO_HOME/extensions/<install-name>/` are discovered for each project and appear in Settings > Extensions as disabled until they are explicitly enabled through the dashboard, CLI, SDK, or API.

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
  treeItems: {},
  modes: {},
  views: {},
  routes: {},
  settingsPanels: {},
  activityRenderers: {},
  sessionAnchorRenderers: {},
  artifactMounts: {},
  templateTypes: {},
  templates: {},
  skills: {},
  themes: {},
  fileIconThemes: {},
  workspaceTypes: {},
  harnesses: {},

  initialSetup: async () => {},
  migrate: async () => {},
});
```

Do not include `id`, `name`, `namespace`, `version`, `description`, or `apiVersion` in `defineExtension()`. TypeScript rejects identity fields on the contribution object.

## Contribution Surfaces

| Surface | Product role |
| ------- | ------------ |
| `commands` | User-triggered, CLI-triggered, scheduled, or automation-triggered operations. |
| `middlewares` | Pre-command checks that may continue, patch params, replace invocation data, or reject. |
| `hooks` | Event observers that run after a product event is emitted. |
| `schedules` | Cron-driven command invocation. |
| `routes` | Dashboard pages backed by extension webviews. |
| `treeItems` | Sidebar or area-tree navigation entries attached to host targets. |
| `views` | Workbench panels backed by extension webviews. |
| `settingsPanels` | Dashboard settings UI for extension-owned configuration. |
| `modes` | Lightweight workbench mode metadata: id, label, and optional icon. |
| `activityRenderers`, `sessionAnchorRenderers` | Webview-backed renderers for supported dashboard records. |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets. |
| `artifactMounts` | Safe repo-local file access under `.pstdio/<package-name>/`. |
| `workspaceTypes`, `harnesses` | Provider integrations owned by the extension runtime. |
| `initialSetup`, `migrate` | Install-time and upgrade-time lifecycle work. |

UI-facing contributions attach to implemented host-owned targets. The attachment model is covered in [Dashboard UI attachments](./workbench-attachments.md).

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

## Authoring Boundaries

Extensions declare metadata and handlers; the host owns installation, project enablement, command routing, workbench chrome, trusted context keys, and layout primitives.

Extension code should not:

- define package identity inside `defineExtension()`
- invent dashboard target ids outside the SDK target registry
- import from `clients/*`
- write outside package assets, API-owned storage, or declared artifact mounts
- assume a target maps to a fixed physical location across dashboard implementations

When extension UI needs dashboard placement, attach it to a host-owned target and optionally add a `when` expression. The dashboard decides how that target maps to current UI.

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

Middleware attaches to a command and runs before the command handler. Use it for gates and command-shaping logic: validation, default params, context normalization, and rejections with user-facing reasons.

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

Middleware may return `ctx.commands.continue()`, `patchParams()`, `replaceParams()`, `replaceInvocation()`, or `reject()`. Returning nothing is treated as continue.

Hooks observe emitted events. Use them for follow-up automation after something has happened: status sync, worktree cleanup, session creation, notifications, activity records, or command lifecycle reactions. Hooks cannot mutate or veto the operation that emitted the event.

```ts
export default defineExtension({
  hooks: {
    recordCreatedTicket: {
      eventId: "planner.ticket.created",
      async handler(ctx, event) {
        await ctx.storage.set("lastTicketId", event.ticketId);
      },
    },
  },
});
```

Prefer exported event refs such as `ticketEvents.archived`, `sessionEvents.started`, `attemptStatusEvents.changed`, and `worktreeEvents.created`. Use `commandEvent(commandRef(...), "completed")` or another command lifecycle phase when a hook should react to a command outcome.

## Dashboard UI Contributions

Dashboard UI contributions are declarative:

- menus attach commands to targets such as `workbench.top.actions` or `workbench.commandPalette`
- tree items attach routes, commands, or links to area-tree targets such as `workbench.left.tree`
- views and settings panels use webview package assets
- modes declare lightweight mode metadata

Visibility can be limited with `when`:

```ts
menus: [
  {
    target: "workbench.top.actions",
    label: "Run review",
    when: { mode: "workspace", resourceType: ["workspace"] },
  },
];
```

See [Dashboard UI attachments](./workbench-attachments.md) and [Extension modes](./modes-and-layout.md) for the current product contract.

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
