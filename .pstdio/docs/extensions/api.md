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
- [Remote execution migration](./remote-execution-migration.md): named connections, remote workspaces, harnesses, and automation.

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
    "pstdio": "1.0.0-alpha.10"
  },
  "pstdio": {
    "scope": "user"
  }
}
```

Required fields:

- `engines.pstdio`: the exact extension API version this extension was built against. While the API
  is in alpha this is a plain version such as `1.0.0-alpha.10`, never a range: `^1.0.0-alpha.10` also
  matches `1.0.0-alpha.10`, so a range would accept hosts the extension was never tested on. The host
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

- `pst extensions add <name>` resolves the name through the extension catalog. The catalog entry
  names the Git repository, folder, and release ref. Prompt Studio records the resolved commit with
  the install, so the installed source stays pinned even when a tag or branch moves.
- `pst extensions add <name> --branch <branch>` installs from a branch instead. A branch moves, so
  this is for extension development only.
- Editing a folder under the extensions root does not change what a project runs. The extension is
  marked as having an update available, and the project keeps running the version it adopted.
- Choosing **Update** in the extension panel validates the source on disk and adopts it. If the source
  is refused, for example because it targets a different `engines.pstdio`, the previously adopted
  version keeps running and the update stays on offer.
- A catalog extension shows **Upgrade** when its recorded commit differs from the catalog release.
  Upgrade fetches that origin, validates it in staging, replaces the installed source, and adopts it.
  Healthy local-path extensions stay under local control.
- `pst extensions update [name]` runs that same host-owned upgrade path for the linked project. When
  `name` is omitted, it upgrades every instance the host marks as eligible. The command does not
  replace healthy local sources or change whether an extension is enabled.
- Catalog entries marked `default` are installed for new projects. Catalog membership alone does not
  make an extension a default. The packaged catalog defaults to the harnesses, base themes, and
  Prompt Studio skills.
- An adopted extension whose `engines.pstdio` does not match the host is shown as an error in the
  extension list and detail view. The error names both API versions and offers Upgrade when the
  extension has a catalog origin.

The host reads its packaged catalog unless `PSTDIO_EXTENSION_CATALOG` points to a local JSON file or
an HTTPS URL. Remote catalogs are cached under `$PSTDIO_HOME/cache/extension-catalog`. The catalog is
trusted configuration because every entry names code the host may run.
- Editing an installed folder still rebuilds that extension's webview assets, so an open webview
  updates while you work. Only its contributions wait for the update, because those are what the
  project agreed to run.
- `pst extensions dev <path>` still reinstalls on every edit. That is an explicit development loop,
  not automatic adoption.

## Developing A Repo-Scoped Extension

A repo-scoped extension installs into `<repo>/.pstdio/extensions/<install-name>`, which is often the
folder you are already editing. Point `pst extensions dev` at that folder and it is validated where
it is. Nothing is copied, replaced, or deleted, so untracked and ignored files in the folder survive
a refresh.

Every refresh republishes what the folder declares now. A command you removed stops being served,
and a command you added is available at once. A source whose last refresh failed does not keep
serving the commands of an earlier version. Extension status, the listed commands, and command
execution always describe the same folder.

When a refresh fails, the development loop prints the failure and then `no new runtime published for
<name>`. The previous runtime keeps running, the watcher stays attached, and the next edit retries.

## One Provider Per Extension Id

A project runs one source per extension id. Command execution, webview metadata, and the extension
panel all resolve an extension by that id, so a second enabled source claiming the same id would let
them disagree.

- Enabling a source takes the id from whatever held it before. That covers the extension panel,
  `pst extensions add`, and `pst extensions dev`, where you say which copy you want. The source that
  held the id becomes disabled and stays listed, so you can switch back.
- Discovery never takes an id away. When a linked repository contributes a folder whose id another
  enabled source already provides, that folder is registered **disabled**. Nothing that was running
  stops running, and you pick the copy you want in the extension panel.

This matters when two linked repositories carry the same extension, and when a repository carries a
copy of an extension you already installed for your user. In both cases the copy you were already
running keeps the id until you say otherwise.

The extension detail view shows the source folder of each installed extension, which is what tells
two copies of the same extension apart.

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
import { defineCommand, defineExtension, params } from "@pstdio/sdk/extensions";

const createTicket = defineCommand({
  id: "tickets.create",
  title: "Create ticket",
  cli: true,
  params: { title: params.text({ label: "Title" }) },
  async run(_ctx, commandParams) {
    return { created: true, title: commandParams.title };
  },
});

export default defineExtension({
  commands: [createTicket],
  views: [],
  pages: [],
  viewMenus: [],
  placements: [],
  navigationItems: [],
  modes: [],
  resourceKinds: [],
  navigationTrees: [],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
});
```

Do not include `id`, `name`, `namespace`, `version`, `description`, or `apiVersion` in `defineExtension()`. TypeScript rejects identity fields on the contribution object.

## Contribution Surfaces

| Surface                                           | Product role                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `commands`                                        | User-triggered, CLI-triggered, scheduled, or automation-triggered operations.                     |
| `keybindings`                                     | Global app-level shortcuts that run a navigation action, using TanStack Hotkeys syntax.           |
| `middlewares`                                     | Pre-command checks that may continue, patch params, replace invocation data, or reject.           |
| `hooks`                                           | Event observers that run after a product event is emitted.                                        |
| `schedules`                                       | Cron-driven command invocation.                                                                   |
| `views`                                           | Reusable webview, tree, file, controls, table, and Kanban bodies.                                  |
| `viewMenus`                                       | View bodies attached as menus owned by another view.                                               |
| `pages`                                           | Routed screens with resource constraints, Main presentation, and extra panel slots.                                 |
| `placements`                                      | Mode-wide static views or resource bindings.                                                        |
| `navigationItems`, `navigationTrees`              | Explicit actions and Sidenav trees owned by a mode or page.                                        |
| `resourceKinds`                                   | Domain resource identity, labels, icons, menus, and hierarchy.                                     |
| `resourceHierarchyProviders`                      | Domain parent lookup for resources. Page targets supply breadcrumb destinations.                                   |
| `statusBarItems`                                  | Views in the host status bar; all visible items render without layout persistence.                 |
| `statuses`                                        | Workflow status providers shared by Kanban views and the host settings editor.                     |
| `settingsPanels`                                  | References that place views in host-owned settings slots.                                          |
| `modes`                                           | Typed Workbench mode contributions.                                                                |
| `activityItems`                                   | Activity-rail entries that select a Workbench mode.                                                |
| `templates`, `skills`, `themes`, `fileIconThemes` | Packaged catalog assets.                                                                          |
| `artifactMounts`                                  | Safe repo-local file access under `.pstdio/extension-storage/<package-name>/`.                                      |
| `workspaceTypes`, `harnesses`                     | Provider integrations owned by the extension runtime.                                             |
| `connections`                                     | Host-managed HTTP access to a declared remote control plane.                                       |

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
local command id tickets.create
runtime id       pstdio.planner.command.tickets.create
CLI path         pst planner tickets create
artifact root    <repo>/.pstdio/extension-storage/planner/
theme id         planner.<theme-key>
template id      planner.<template-key>
skill id         planner.<skill-key>
```

The old `namespace` concept is removed. Use the package `name` anywhere extension-facing code needs a short project scope.
Publisher-qualified runtime ids are host routing details. Extension code declares local ids and uses typed refs.
For same-extension composition, use the `ref` returned by `defineCommand()`.

Every local contribution id follows one grammar: lowercase kebab-case segments separated by single dots, matching
`[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*`. Dots express local grouping (and derive default CLI paths
for commands): `ticket-status.create` becomes `pst <extension> ticket-status create`. Ownership never lives in the id:
a ref's `extensionId` carries it. `pst extensions check` rejects ids outside the grammar with the code
`extension_contribution_id_invalid`. Host-published refs (for example `workbenchPages.start`) resolve to the
host's registered id without owner prefixing, for every contribution kind; runtime ids such as
`pstdio.planner.command.tickets.create` are opaque routing values that no code may split back into parts.

When another extension needs a public command, the provider owns and exports that contract from one module:

```ts
import { commandRef } from "@pstdio/sdk/extensions";

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "planner" });

export const plannerCommands = {
  publish: plannerCommand<{ version: string }, { published: boolean }>("publish"),
};
```

Consumers import `plannerCommands.publish`. They do not repeat the provider identity or rebuild runtime ids.

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

Set `automation: true` only on commands that a scoped machine token may run. The host validates the declared params before it creates a durable automation run. Commands without this flag cannot be added to a machine token.

```ts
import { defineCommand } from "@pstdio/sdk/extensions";
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  commands: [
    defineCommand({
      id: "publish",
      title: "Publish release",
      description: "Create release notes and run the publish workflow.",
      cli: true,
      params: {
        version: params.text({ label: "Version" }),
      },
      async run(_ctx, commandParams) {
        return { ok: true, version: commandParams.version };
      },
    }),
  ],
});
```

Use `params.template({ type: "ticket" })` when a command selects a template. The dashboard lists templates from the
matching extension-owned template type and renders a dropdown. Use `params.resource({ resourceType: "workspace" })`
for project resources. The dashboard lists registered resources of that type and passes the selected `{ type, id }`
reference to the command.

## Named connections

Extensions declare remote HTTP access by name. The host stores the base URL and credential. Extension code receives request and stream methods, never the secret value.

```ts
import { defineConnection, defineExtension } from "@pstdio/sdk/extensions";

const controlPlane = defineConnection({
  id: "control-plane",
  label: "Remote control plane",
  transport: "http",
  auth: { type: "bearer" },
  allowedMethods: ["GET", "POST"],
  allowedPathPrefixes: ["/v1/workspaces", "/v1/sessions"],
  check: { method: "GET", path: "/v1/workspaces/health" },
  supportsStreaming: true,
});

export default defineExtension({
  connections: [controlPlane],
  commands: [
    {
      id: "remote-status",
      ref: { kind: "command", id: "remote-status" },
      title: "Read remote status",
      async run(ctx) {
        return ctx.connections.request("control-plane", {
          method: "GET",
          path: "/v1/workspaces/current",
        });
      },
    },
  ],
});
```

Connection requests must use a relative path. The host rejects undeclared methods, paths outside the declared prefixes, cross-origin redirects, oversized bodies, and non-HTTPS URLs outside loopback development. It replaces caller authentication with the stored credential. A declared `check` gives the settings UI, SDK, and `pst connections check` a fixed safe health probe.

Harnesses that can use a remote execution target set `cwdRequirement: "optional"`. Their start, resume, reattach, and message inputs receive `workspace.executionTarget`. A remote target contains the provider id and its opaque provider reference. It does not contain a local path.

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

Keybindings bind app-level keyboard shortcuts to a navigation `action`. The action is any navigation target: a command, a page, a panel, an href, or a compound target. Pages and panels bind directly; no wrapper command is needed. Chords use `@tanstack/hotkeys` syntax and are validated by the extension runtime. Invalid chords, modifier-only chords, and duplicate platform-aware chords are reported by extension checks and dropped from metadata.

Prefer `Mod+...` so the chord maps to `Cmd` on macOS and `Ctrl` on Windows/Linux without an override. Avoid chords already claimed by browsers, OSes, or developer tooling (`Mod+T`, `Mod+W`, `Mod+R`, `Mod+P`, `Mod+S`, `Mod+Shift+P`, `Mod+Shift+I`, `F5`, `F11`, `F12`, …); the extension runtime emits a `reserved_keybinding_chord` warning when a contribution hits a reserved chord on any platform. Reach for multi-step chords like `mod+k mod+t` if no single chord is safe.

```ts
import { defineCommand, defineExtension, defineKeybinding } from "@pstdio/sdk/extensions";

const preview = defineCommand({
  id: "preview",
  title: "Preview",
  async run(_ctx, _commandParams) {
    return { opened: true };
  },
});

export default defineExtension({
  commands: [preview],
  keybindings: [
    defineKeybinding({
      id: "preview",
      key: "mod+shift+y",
      mac: "cmd+shift+y",
      win: "ctrl+shift+y",
      linux: "ctrl+shift+y",
      action: { kind: "command", target: { command: preview.ref } },
      when: { resourceType: [{ extensionId: "pstdio.marp", kind: "resource-kind", id: "presentation" }] },
    }),
  ],
});
```

A command action may pass params with `target: { command: preview.ref, params: { ... } }`. Use `action: { kind: "page", page: somePage.ref }` or `action: { kind: "panel", panel: somePage.panels.someSlot }` to open a page or panel directly.

## Middlewares And Hooks

Middleware attaches to a command and runs before the command handler. Use it for gates and command-shaping logic: validation, default params, context normalization, and rejections with user-facing reasons.

```ts
import { commandRef, defineExtension, defineMiddleware } from "@pstdio/sdk/extensions";
const createTicket = commandRef.forExtension({ publisher: "pstdio", name: "planner" })<{ title: string }>(
  "tickets.create",
);
export default defineExtension({
  middlewares: [
    defineMiddleware<{ title: string }>({
      id: "require-title",
      command: createTicket,
      async run(ctx, commandParams) {
        if (!commandParams.title) {
          return ctx.commands.reject({
            code: "missing_title",
            reason: "Title is required",
          });
        }
      },
    }),
  ],
});
```

Middleware may return `ctx.commands.continue()`, `patchParams()`, `replaceParams()`, `replaceInvocation()`, or `reject()`. Returning nothing is treated as continue.

Hooks observe emitted events. Use them for follow-up automation after something has happened: status sync, worktree cleanup, session creation, notifications, activity records, or command lifecycle reactions. Hooks cannot mutate or veto the operation that emitted the event.

```ts
import { defineExtension, defineHook, sessionEvents } from "@pstdio/sdk/extensions";
export default defineExtension({
  hooks: [
    defineHook<{ sessionId: string }>({
      id: "record-started-session",
      event: sessionEvents.started,
      async run(ctx, event) {
        await ctx.storage.set("lastSessionId", event.sessionId);
      },
    }),
  ],
});
```

Prefer exported event refs such as `sessionEvents.started` and
`worktreeEvents.created`. Planner ticket automation should use planner commands
or command lifecycle events, not removed core ticket/attempt-status events. Use
`commandEvent(providerCommands.someCommand, "completed")` or another command lifecycle phase
when a hook should react to a command outcome.

## Dashboard UI Contributions

Dashboard UI contributions have one ownership model:

- a view owns its body and may use `webview`, `tree`, `file`, `controls`, `dataTable`, or `kanban`
- a page owns a route, mode, optional resource constraint, Main presentation, and extra slots
- a placement owns a shared mode panel with a static-view or resource-binding item
- a navigation item uses a typed action instead of encoded route or command fields
- a navigation tree adds a tree view to a mode or page in the shared Sidenav
- a view menu references its owner view and menu view
- status-bar and settings contributions reference views; they do not duplicate view bodies

Local ids are explicit. The runtime normalizes them as
`${extensionId}.${contributionKind}.${localId}`. Use the `ref` returned by each `define*`
helper instead of rebuilding that id. Resources still identify domain objects such as
tickets, workspaces, and sessions. Paths belong to pages, never views.

```ts
import { defineExtension, defineNavigationTree, defineView, workbenchModes } from "@pstdio/sdk/extensions";

const files = defineView({
  id: "files",
  title: "Files",
  body: {
    kind: "tree",
    body: async () => [{ id: "files", label: "Files", nodes: [] }],
  },
});

export default defineExtension({
  views: [files],
  navigationTrees: [
    defineNavigationTree({
      id: "project-files",
      owner: workbenchModes.project,
      slot: "content",
      view: files.ref,
    }),
  ],
});
```

`body` returns tree sections. Optional `children` and `footer` callbacks return nodes for lazy children and footer
content. Renderer callbacks receive the active project, resource, renderer id, tree state, filter text, and selected
node context.

The owner can be a mode or page ref. Mode sections appear before page sections. The Sidenav renders one tree with
pinned `header` and `footer` slots and one scrolling `content` slot.

Visibility can be limited with `when`:

```ts
menus: [
  {
    target: "workbench.nav.actions",
    label: "Run review",
    when: { resourceType: [workbenchResourceKinds.workspace] },
  },
];
```

Workspace resources use the host project mode. Target workspace actions with
`workbenchResourceKinds.workspace`; the SDK does not export a host workspace mode.

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
- `client.artifacts` has `list(mount, prefix?)`, `readText(mount, path)`, and
  `imageUrl(mount, path)` for artifact mounts the webview declared with
  `artifactsRead(mount)` (see "Artifact Mounts And Storage"). `imageUrl` returns a short-lived URL
  for png, jpeg, webp, or gif, usable in `<img src>`; request a fresh URL when one
  expires. Undeclared mounts are denied by the capability gate with the exact missing
  declaration, such as `artifacts.read:runs`.
- The `files` render helper picks local files and stores extension-owned files. See
  [Webview files](#webview-files).
- `navigation.open` opens an explicit page or panel target. See
  [Navigate from a webview](#navigate-from-a-webview).
- Author commands with `defineCommand`. Commands written as inline literals inside
  `defineExtension` keep untyped results (see ADR 0012 in the repository docs).
- Pass `{ extensionId }` as the second argument only in tests, where no host bridge
  provides one.

### Webview files

`defineExtensionView` passes a `files` client to `render`. `pick` opens the browser's
file picker and does not contact the host. Upload, list, and delete cross the webview
bridge, so the view must declare each method it calls.

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

| Method | Declaration | Input | Result |
| --- | --- | --- | --- |
| `files.pick(options?)` | None | `{ accept?, multiple? }` | Browser `File[]`; an empty array means the user cancelled. |
| `files.upload(input)` | `files.upload` | `{ name, data, mimeType?, scope? }` | The stored `ExtensionBlobRef`. `data` accepts `Uint8Array` or `ArrayBuffer`. |
| `files.list(input?)` | `files.list` | `{ scope? }` | `ExtensionBlobRef[]` for the exact scope. |
| `files.delete(id)` | `files.delete` | A file id returned by upload or list. | Resolves after the host deletes the owned file. |

```ts
import { defineExtensionView } from "@pstdio/sdk/extensions";

export default defineExtensionView({
  async render({ files, mount }) {
    const [selected] = await files.pick({ accept: ".csv,text/csv" });
    if (!selected) return;

    const uploaded = await files.upload({
      name: selected.name,
      data: await selected.arrayBuffer(),
      mimeType: selected.type || "text/csv",
    });

    const projectFiles = await files.list();
    mount.textContent = `${uploaded.name} is one of ${projectFiles.length} stored files.`;

    // Delete the file when the extension no longer needs it.
    // await files.delete(uploaded.id);
  },
});
```

The host, not the guest, selects the active project and extension instance. A webview
cannot use a request field to read or write another extension's files. The optional
scope only groups files inside that owner boundary:

| Scope | Webview value | Meaning |
| --- | --- | --- |
| Project | Omit `scope` or use `{ type: "project" }` | Files shared by this extension across the active project. |
| Repository | `{ type: "repo", id: repoId }` | Files grouped under one repository id. |
| Resource | `{ type: "resource", id: resourceId }` | Files grouped under one resource id. |
| Extension-defined | `{ type: "import", id: importId }` | Files grouped by a type and id chosen by the extension. Include the id when a command must access the scope. |

Upload and list must use the same scope to find the same files. The default project
scope matches `ctx.storage.files` in commands. A command can read the bytes without a
second upload:

```ts
const contents = await ctx.storage.files.getBytes(params.fileId);
```

The command storage API names the same scopes with runtime objects, not the webview
`{ type, id }` shape:

| Webview scope | Matching command storage |
| --- | --- |
| Omitted or `{ type: "project" }` | `ctx.storage.files` |
| `{ type: "repo", id: repoId }` | `ctx.storage.scope({ type: "repo", repoId }).files` |
| `{ type: "resource", id: resource.id }` | `ctx.storage.scope({ type: "resource", resource }).files`, where `resource` is the full `{ type, id, ... }` resource reference. |
| `{ type: "import", id: importId }` | `ctx.storage.scope({ type: "import", id: importId }).files` |

Repository scopes use `repoId`, resource scopes use a full resource reference, and
extension-defined command scopes require an id. The upload limit is 25 MiB. The
returned `ExtensionBlobRef` contains `id`, `name`, `mimeType`, `size`, `hash`, `url`,
`createdAt`, and `updatedAt`.

Host-backed file methods need a project extension instance. They are available to
declared project pages, panels, and project settings views. A global
settings view has no project file owner, so it does not receive these methods. Keep
`files.pick` available there only when selecting a local file without uploading it.

The declaration gate still applies. If the view omits a declaration, the bridge rejects
the call before it reaches the file host.

### Navigate from a webview

Add `navigation.open` to the view and pass an explicit page or panel target:

```ts
const details = defineView({
  id: "details",
  title: "Details",
  body: {
    kind: "webview",
    entry: packageAsset("./webviews/details.ts", import.meta.url),
    capabilities: ["navigation.open"],
  },
});
```

```ts
await host.call("navigation.open", {
  target: {
    kind: "page",
    page: { kind: "page", id: "ticket" },
    resource: {
      type: "ticket",
      id: "PS-260",
      label: "Dashboard webview capabilities",
      metadata: { status: "in-review" },
    },
  },
});
```

The target chooses the destination. A resource supplies identity and input only. The
dashboard does not search for a matching screen by resource kind. The bridge rejects
the call if the view did not declare `navigation.open` or the target is invalid.

`@pstdio/sdk/extensions/react` ships react-query hooks built on the client. `react` and
`@tanstack/react-query` are optional peer dependencies used only by this entry.

```tsx
import { useCommandMutation, useCommandQuery } from "@pstdio/sdk/extensions/react";

const statuses = useCommandQuery({
  queryKey: ["ticket-statuses"],
  command: client.commands["ticket-status.read"],
});

const saveStatus = useCommandMutation({
  command: client.commands["ticket-status.update"],
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

Template files are extension defaults, not host records. If users can edit them, declare a template type with `list`, `read`, `save`, and `delete` command refs. Keep overrides in `ctx.storage` and read untouched defaults through `ctx.packageFiles`. The dashboard discovers the type and calls those commands; it does not know the extension's storage format.

The command values use these shapes:

- `list`: returns `{ name, title, type }[]`.
- `read`: accepts `{ name }` and returns `{ name, title, type, content } | null`.
- `save`: accepts `{ name, title?, type, content }` and returns the saved item.
- `delete`: accepts `{ name }`.

```ts
import { defineTemplate } from "@pstdio/sdk/extensions";
import { defineExtension, defineView, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  templates: [
    defineTemplate({
      id: "ticket",
      title: "Ticket",
      type: "ticket",
      source: packageAsset("./templates/ticket.md", import.meta.url),
    }),
  ],
  views: [
    defineView({
      id: "planner",
      title: "Planner",
      body: {
        kind: "webview",
        entry: packageAsset("./webviews/planner.tsx", import.meta.url),
      },
    }),
  ],
});
```

Package asset paths must be relative and stay inside the package.

Command and hook handlers can read other packaged files through `ctx.packageFiles`. This API is read-only and scoped to the installed package root. Files omitted from an installed copy by `.gitignore` are unavailable at runtime.

Set `pstdio.repoFiles.tracked` in the package manifest to control the allocated `ctx.extensionFiles` repo mount. It is rooted at `.pstdio/ext/<publisher>.<name>/`. The host adds an ignore entry on the first write unless `tracked` is true.

## Artifact Mounts And Storage

Artifact mounts are constrained to a package-name root under each repo's extension storage directory:

```txt
<repo>/.pstdio/extension-storage/<package-name>/...
```

For package `planner`, the default scoped root is:

```txt
<repo>/.pstdio/extension-storage/planner/
```

Extension storage is API-owned and scoped by extension instance. Project-owned storage also carries the project id.

Artifact mounts create their directories on the first write. Before that, `exists()` returns false and `list()` returns an empty array.

The mount's `path` is relative to that package-name root, and its `id` is only the mount's local name — it
appears in refs and capability grants, never in the disk path. For package `planner`,
`defineArtifactMount({ id: "runs", path: "runs", label: "Runs" })` resolves to
`<repo>/.pstdio/extension-storage/planner/runs/`, and a read of `a/summary.json` targets
`<repo>/.pstdio/extension-storage/planner/runs/a/summary.json`.

### Webview reads

A webview can read a mount its own extension defines by declaring the `artifacts.read` capability, scoped to
that mount:

```ts
import { artifactsRead, defineArtifactMount, defineView, packageAsset } from "@pstdio/sdk/extensions";

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
```

Each declaration grants exactly one mount; there is no wildcard, and `pst extensions check` fails a grant on a
mount the extension does not define (`webview_artifact_mount_missing`). All enforcement runs on the host:
reads stay inside the declared mount (traversal and symlink escapes are rejected before filesystem access),
text reads over 5 MB and images over 20 MB return limit errors instead of truncated content, and image URLs
are minted only for png, jpeg, webp, and gif. Image bytes are served through the capability-secured webview
asset channel with short-lived, fully-bound signed URLs (ADR 0008). Webviews never write to mounts; mutation
goes through commands.

## Workspace Cleanup

`ctx.workspaces.removeWorktree(id)` removes the local worktree and branch but preserves the workspace record. `ctx.workspaces.delete(id)` performs the full provider cleanup and deletes the workspace. Both operations emit `worktree.removed` when they remove a local worktree.

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

Warnings are actionable even when the extension still loads. For example, `extension_icon_unknown` means a contribution named an icon the host does not ship; the contribution loads, but the dashboard shows a fallback icon. Composition errors such as `invalid_placement` (a placement has an invalid shape) and `invalid_page_slot` (a page slot has an invalid shape) drop the invalid contribution and keep the rest of the extension loading. Invalid declarations report the extension, contribution, field path, and expected contract. Nested unknown fields are rejected.
