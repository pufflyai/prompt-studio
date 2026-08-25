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
    "pstdio": "1.0.0-alpha.3"
  },
  "pstdio": {
    "scope": "user"
  }
}
```

Required fields:

- `engines.pstdio`: the exact extension API version this extension was built against. While the API
  is in alpha this is a plain version such as `1.0.0-alpha.3`, never a range: `^1.0.0-alpha.3` also
  matches `1.0.0-alpha.3`, so a range would accept hosts the extension was never tested on. The host
  refuses an extension whose value does not match its own `EXTENSION_API_VERSION`, with a single
  diagnostic instead of per-contribution errors. Expect to update this on most releases while the
  API is unstable.
- `name`: package name and project-facing scope, matching `^[a-z][a-z0-9-]*$`.
- `version`: extension package semver.
- `publisher`: publisher id segment, matching `^[a-z][a-z0-9-]*$`.
- `main`: relative path to the extension entry file inside the package.

Optional fields:

- `displayName`: dashboard display name. Falls back to `name`.
- `description`: dashboard/catalog description.
- `pstdio.scope`: install/load scope, either `user` or `repo`. Defaults to `user`.

Derived fields:

- Extension id is always `${publisher}.${name}`.
- Command ids, CLI paths, artifact paths, themes, templates, and skills are scoped by package `name`.

Invalid packages produce diagnostics from `pst extensions check`. Missing manifest fields, invalid `main`, unsupported `engines.pstdio`, and entry import failures are reported with the package path.

## Installing And Updating

Installs and updates are explicit. Source that appears in the extensions root is never adopted on its own.

- `pst extensions add <name>` installs the extension that belongs to the running release. The name is
  resolved to a release tag, then to the commit that tag points at, and that commit is recorded with
  the install. The same install can never resolve to different source later.
- `pst extensions add <name> --branch <branch>` installs from a branch instead. A branch moves, so
  this is for extension development only.
- Editing a folder under the extensions root does not change what a project runs. The extension is
  marked as having an update available, and the project keeps running the version it adopted.
- Choosing **Update** in the extension panel validates the source on disk and adopts it. If the source
  is refused, for example because it targets a different `engines.pstdio`, the previously adopted
  version keeps running and the update stays on offer.
- A Git-backed Marketplace extension shows **Update** in its detail view. Update fetches the extension
  from the running Prompt Studio release, validates it in staging, replaces the installed source, and
  adopts it. Local-path extensions do not show this action because their source belongs to the user.
- Prompt Studio's default extensions are Marketplace entries. Packaged hosts fetch them from the Git
  release paired with the host. Removing one leaves its Marketplace entry available for reinstall.
- An adopted extension whose `engines.pstdio` does not match the host is shown as an error in the
  extension list and detail view. The error names both API versions and offers Update when the host
  owns the source.
- Editing an installed folder still rebuilds that extension's webview assets, so an open webview
  updates while you work. Only its contributions wait for the update, because those are what the
  project agreed to run.
- `pst extensions dev <path>` still reinstalls on every edit. That is an explicit development loop,
  not automatic adoption.

## Releasing A Breaking Contract Change

The extension API version, the host, and the bundled extensions move together.

A change that breaks an extension contract must, in the same pull request:

1. Bump `EXTENSION_API_VERSION` to the next alpha.
2. Update `engines.pstdio` in every extension in this repository.

`bun run verify:extension-api-version` fails when any manifest is left behind, so a release can never
be half-migrated.

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
    defaultStatus: params.text({
      label: "Default status",
      defaultValue: "backlog",
    }),
  },

  commands: {
    "tickets.create": {
      title: "Create ticket",
      cli: true,
      params: {
        title: params.text({ label: "Title" }),
      },
      async run(_ctx, commandParams) {
        return { created: true, title: commandParams.title };
      },
    },
  },

  keybindings: {
    "tickets.create": {
      key: "mod+shift+y",
      mac: "cmd+shift+y",
      win: "ctrl+shift+y",
      linux: "ctrl+shift+y",
      command: "tickets.create",
      args: { source: "shortcut" },
      when: { mode: "tickets" },
    },
  },

  middlewares: {},
  hooks: {},
  schedules: {},
  treeItems: {},
  modes: {},
  routes: {},
  panels: {},
  resourceKinds: {},
  resourcePanels: {},
  resourceHierarchyProviders: {},
  statusItems: {},
  treeRenderers: {},
  fileRenderers: {},
  controlsRenderers: {},
  dataTableRenderers: {},
  kanbanRenderers: {},
  settingsPanels: {},
  activityItems: {},
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

| Surface                                           | Product role                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `commands`                                        | User-triggered, CLI-triggered, scheduled, or automation-triggered operations.                     |
| `keybindings`                                     | Global app-level shortcuts that invoke extension commands using TanStack Hotkeys syntax.          |
| `middlewares`                                     | Pre-command checks that may continue, patch params, replace invocation data, or reject.           |
| `hooks`                                           | Event observers that run after a product event is emitted.                                        |
| `schedules`                                       | Cron-driven command invocation.                                                                   |
| `routes`                                          | Dashboard pages backed by extension webviews.                                                     |
| `treeItems`                                       | Sidenav or area-tree navigation entries attached to host targets.                                 |
| `treeRenderers`, `fileRenderers`                  | Callback-backed native Workbench trees and file content.                                          |
| `controlsRenderers`, `dataTableRenderers`         | Callback-backed native controls and tabular data.                                                  |
| `kanbanRenderers`                                 | Callback-backed native boards and lists.                                                           |
| `panels`                                          | Workbench panels with a webview or native renderer body and optional owned placement.              |
| `resourceKinds`, `resourcePanels`                 | Domain resource types with named slots, and cross-extension panel-to-slot bindings.                |
| `resourceHierarchyProviders`                      | Parent lookup for resources, used for breadcrumbs and hierarchy.                                   |
| `statusItems`                                     | Status-surface chrome rendered by the host; not part of docked layout.                             |
| `settingsPanels`                                  | Dashboard settings UI for extension-owned configuration.                                          |
| `modes`                                           | Workbench modes with placement recipes for accepted resource kinds.                                |
| `activityItems`                                   | Activity-rail entries that select a Workbench mode.                                                |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets.                                                                          |
| `artifactMounts`                                  | Safe repo-local file access under `.pstdio/<package-name>/`.                                      |
| `workspaceTypes`, `harnesses`                     | Provider integrations owned by the extension runtime.                                             |
| `initialSetup`, `migrate`                         | Install-time and upgrade-time lifecycle work.                                                     |

UI-facing contributions attach to implemented host-owned targets. The attachment model is covered in [Dashboard UI attachments](./workbench-attachments.md).

## Kanban create results

A Kanban `createRow` command may return a `resource` next to the created record. Return the same canonical resource
reference used by the renderer query. Include `metadata.resourceParent` when the resource has a breadcrumb parent.
The dashboard opens this reference after creation, so the created resource has the same label and hierarchy as a row
opened from the board.

```ts
return {
  ...task,
  resource: {
    type: "task",
    id: task.id,
    label: task.title,
    metadata: {
      resourceParent: { type: "view", viewId: "planner.tasks" },
    },
  },
};
```

The dashboard still falls back to the created record's `id`, `shorthand`, and `title` when `resource` is absent. That
fallback has no extension-owned hierarchy metadata.

## IDs And Scopes

For the package above:

```txt
package name     planner
publisher        pstdio
extension id     pstdio.planner
command id       planner.tickets.create
CLI path         pst planner tickets create
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
      async run(_ctx, commandParams) {
        return { ok: true, version: commandParams.version };
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
  | {
      ok: false;
      status: "error";
      code?: string;
      reason: string;
      error?: SerializedError;
    };
```

## Keybindings

Keybindings bind app-level keyboard shortcuts to extension commands. Chords use `@tanstack/hotkeys` syntax and are validated by the extension runtime. Invalid chords, modifier-only chords, and duplicate platform-aware chords are reported by extension checks and dropped from metadata.

Prefer `Mod+...` so the chord maps to `Cmd` on macOS and `Ctrl` on Windows/Linux without an override. Avoid chords already claimed by browsers, OSes, or developer tooling (`Mod+T`, `Mod+W`, `Mod+R`, `Mod+P`, `Mod+S`, `Mod+Shift+P`, `Mod+Shift+I`, `F5`, `F11`, `F12`, …); the extension runtime emits a `reserved_keybinding_chord` warning when a contribution hits a reserved chord on any platform. Reach for multi-step chords like `mod+k mod+t` if no single chord is safe.

```ts
export default defineExtension({
  commands: {
    preview: {
      title: "Preview",
      async run(_ctx, _commandParams) {
        return { opened: true };
      },
    },
  },
  keybindings: {
    preview: {
      key: "mod+shift+y",
      mac: "cmd+shift+y",
      win: "ctrl+shift+y",
      linux: "ctrl+shift+y",
      command: "preview",
      args: { surface: "testbench" },
      when: { resourceType: ["marp.presentation"] },
    },
  },
});
```

## Middlewares And Hooks

Middleware attaches to a command and runs before the command handler. Use it for gates and command-shaping logic: validation, default params, context normalization, and rejections with user-facing reasons.

```ts
export default defineExtension({
  middlewares: {
    requireTitle: {
      commandId: "planner.tickets.create",
      async handler(ctx, commandParams) {
        if (!commandParams.title) {
          return ctx.commands.reject({
            code: "missing_title",
            reason: "Title is required",
          });
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

Prefer exported event refs such as `sessionEvents.started` and
`worktreeEvents.created`. Planner ticket automation should use planner commands
or command lifecycle events, not removed core ticket/attempt-status events. Use
`commandEvent(commandRef(...), "completed")` or another command lifecycle phase
when a hook should react to a command outcome.

## Dashboard UI Contributions

Dashboard UI contributions are declarative:

- menus attach commands to targets such as `workbench.nav.actions` or `workbench.nav.overflow`; command palette entries use the command's own `palette` field
- tree items attach views, commands, resources, or links to area-tree targets such as `workbench.left.tree`
- native renderers register Workbench trees, files, controls, tables, boards, and lists backed by callbacks
- panels wrap webviews or native renderers, use `show` for default placement, and may declare a deep-link `path`
- resource kinds declare domain resources and named slots; resource panels bind only cross-extension panels to slots
- modes declare placement overrides for slots and known panels in accepted resource kinds
- status items contribute status-surface chrome
- settings panels use webview package assets

Resources identify domain objects such as tickets, workspaces, and sessions. Views identify openable UI. Every panel
and route registers a view under its normalized contribution ID, such as `planner.tasks`. An optional panel or route
`path` resolves to the same view and does not create a resource. The removed `extension-route` and `extension-view` resource kinds are read only
by the bounded persistence migration and must not be used by current extensions.

Native renderers are reusable contributions. Wrap one in a panel with `renderer`; that
field is mutually exclusive with `webview`. Put placement for your own resource kind in
the panel's `show` declaration. Use `resourcePanels` only when the resource kind belongs
to another extension.

```ts
export default defineExtension({
  treeRenderers: {
    files: {
      title: "Files",
      icon: "Files",
      body: async () => [
        {
          id: "files",
          label: "Files",
          nodes: [{ id: "readme", label: "README.md" }],
        },
      ],
      defaultExpandedSectionIds: ["files"],
    },
  },
  resourceKinds: {
    ticket: {
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        navigation: { cardinality: "many", external: true },
      },
    },
  },
  panels: {
    files: {
      title: "Files",
      path: "files",
      show: { for: "ticket", region: "sidenav", required: true },
      renderer: { kind: "tree", id: "files" },
    },
  },
  modes: {
    ticket: {
      id: "planner.ticket",
      label: "Ticket",
      icon: "FileText",
      panelRegions: ["main", "secondary", "side"],
      resources: {
        ticket: {},
      },
    },
  },
});
```

`body` returns tree sections. Optional `children` and `footer` callbacks return nodes for lazy children and footer
content. Renderer callbacks receive the active project, resource, renderer id, tree state, filter text, and selected
node context.

Panel role comes from the resolved placement:

- the `primary` slot of a primary resource kind holds the main content panel; it is closed to external extensions
- other slots hold supporting panels; a slot with `external: true` accepts panels from other extensions
- an owned panel uses `show`; a panel with no `show` can still be opened by a `treeItems` view action or contributed to another extension's slot
- a recipe for a primary resource kind needs exactly one `main` placement, and `required` on a slot placement works only when the slot's cardinality is `one`

Visibility can be limited with `when`:

```ts
menus: [
  {
    target: "workbench.nav.actions",
    label: "Run review",
    when: { mode: "workspace", resourceType: ["workspace"] },
  },
];
```

See [Dashboard UI attachments](./workbench-attachments.md) and [Extension modes](./modes-and-layout.md) for the current product contract.

## Webview Client

Webviews talk to the host through a typed client instead of raw `host.call` strings.
`createWebviewClient` builds one from the extension's exported commands record and
settings contribution. Import both as types only, so no server code enters the webview
bundle.

```tsx
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import type { commands } from "../commands";
import type { settings } from "../settings";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof commands, typeof settings>(host);
    // ...
  },
});
```

- `client.commands` has one function per command key. Params come from the command's
  `params` schema and the result from its `run` return type. Bare keys resolve inside
  the declaring extension; the host bridge provides the extension id. Failed outcomes
  throw with the outcome reason.
- `client.settings` has typed `all`, `get`, and `set` from the settings contribution.
  Declare the settings contribution `as const` and export it so the types stay precise.
- Author commands with `defineCommand`. Commands written as inline literals inside
  `defineExtension` keep untyped results (see ADR 0012 in the repository docs).
- Pass `{ extensionId }` as the second argument only in tests, where no host bridge
  provides one.

`@pstdio/sdk/extensions/react` ships react-query hooks built on the client. `react` and
`@tanstack/react-query` are optional peer dependencies used only by this entry.

```tsx
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";

const statuses = useCommandQuery({
  queryKey: ["ticket-statuses"],
  command: client.commands["ticketStatus.read"],
});

const saveStatus = useCommandMutation({
  command: client.commands["ticketStatus.update"],
  invalidate: [["ticket-statuses"]],
});
```

## Terminal Sessions

Terminals are layered: the workbench-native terminal surface is the product UI, and `terminal.session` is the low-level host service behind it.

- **Runtime contexts** get `ctx.terminal` (an `ExtensionTerminalApi`) when the host wires a PTY supervisor. `ctx.terminal.openSession(request)` returns a host-side `TerminalSessionHandle` with `write`, `resize`, `kill`, and a single-consumer `events()` iterable. The handle never crosses into renderer code.
- **Webviews** declare the `terminal.session` capability — the only public webview terminal capability for this version. Calls are serializable operations (`open`, `write`, `resize`, `kill`, `subscribe`); `open` returns only a `sessionId`, and output/exit events are pushed through the bridge host-event channel. Use `createTerminalSessionBridge(host)` from `@pstdio/sdk/extensions` to get a bridge that plugs into the `Terminal` component from `@pstdio/ui/terminal`. Undeclared webviews are rejected by the capability gate.
- **Lifecycle ownership**: workbench-surface sessions live in `workbench.terminal`; closing the terminal panel kills its session, and disposing the controller kills every live session. Production runtime sessions belong to the app-scoped PTY supervisor, which force-kills live sessions on app shutdown.
- **Dashboard transport**: the dashboard backs `workbench.terminal` with the API terminal transport — `POST /v1/terminal/sessions` opens a PTY on the app supervisor, the SSE `events` endpoint streams base64 output chunks and the exit event, and stdin/resize/kill address the session id. Dashboard extension webviews that declare `terminal.session` get live sessions through this path.
- **Diagnostics** log lifecycle metadata only (session id, pid, exit code, signal) — PTY content is never logged.

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
      webview: {
        entry: packageAsset("./webviews/planner.tsx", import.meta.url),
      },
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

Warnings are actionable even when the extension still loads. For example, `extension_icon_unknown` means a contribution named an icon the host does not ship; the contribution loads, but the dashboard shows a fallback icon. Composition errors such as `extension_panel_contract_invalid` (a panel placement has an invalid shape) and `extension_resource_slot_closed` (an external contribution targets a closed slot) drop the invalid contribution and keep the rest of the extension loading.
