# Extension manifest and installation

Part of the [extension API reference](0001-api.md).

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
    "pstdio": "^0.1.0"
  },
  "pstdio": {
    "scope": "user"
  }
}
```

Required fields:

- `engines.pstdio`: one or more caret ranges of the extension API, separated by `||`, such as `^0.1.0` or `^0.4.2 || ^0.5.0`. The ranges must include the running host's `EXTENSION_API_VERSION`. Exact versions, tilde ranges, wildcards, and prerelease tags are not accepted. See [API versioning](0014-api-versioning.md).
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

### Scoped checks and versions

`pst extensions check` checks the user and repo-local roots. Use `--scope repo` to check only
the current linked project folder, or `--scope user` to check only the user root. Errors outside the
selected scope do not affect the result. The repo scope requires a linked project folder; Git is optional.

The command prints the CLI, extension API, SDK, and bundled dashboard versions before its
diagnostics. `--json` returns them in `versions`, alongside `checks`. Compatibility status and
errors are reported for each checked root.

| Component | Version source | Compatibility rule |
| --- | --- | --- |
| CLI | Installed `pstdio` package | Owns the bundled runtime and dashboard release. |
| Extension API | `EXTENSION_API_VERSION` | Must be included in the caret ranges declared by `engines.pstdio`. |
| SDK | `SDK_VERSION` from `@pstdio/sdk/extensions` | Shares the public fixed release group; its package number is separate from the host contract version. |
| Dashboard | The CLI's bundled dashboard release | Each declared contribution must have a supported host capability. |

An extension that targets an older API is repaired where it comes from. A catalog extension is
upgraded to its build for this host. Any other extension is fixed in its source folder: update the
code for this API, add a caret range for the host's API version to `engines.pstdio` in its
`package.json`, then reload it. An extension that requires a newer API needs a newer Prompt Studio release or an extension build
for this host.

## Installing And Updating

Installs and updates are explicit. Source that appears in the extensions root is never adopted on its own.

- `pst extensions add <name>` resolves the name through the extension catalog. The catalog entry
  names the Git repository, folder, and release ref. Prompt Studio records the resolved commit with
  the install, so the installed source stays pinned even when a tag or branch moves.
- `pst extensions add <name> --branch <branch>` installs from a branch instead. A branch moves, so
  this is for extension development only.
- Editing a folder under the extensions root does not change what a project runs. The extension is
  marked as having local changes (`updateAvailable`), and the project keeps running the version it
  adopted.
- Choosing **Reload** in the extension panel validates the source on disk and adopts it. Nothing is
  fetched: the source folder is the truth. If the source is refused, for example because it targets
  a different `engines.pstdio`, the previously adopted version keeps running and Reload stays on offer.
- A catalog extension shows **Upgrade** when its recorded commit differs from the catalog release.
  Upgrade fetches that origin, validates it in staging, replaces the installed source, and adopts it.
  Healthy local-path extensions stay under local control.
- In the extension panel, every row that can take a newer release shows an upgrade button next to
  its switch. The button upgrades only that extension. **Upgrade all** in the panel header runs
  Upgrade for every extension that offers it, and only appears when at least one does.
- `pst extensions update [name]` runs that same host-owned upgrade path for the project in the
  current folder, or the one named with `--project-id`. When `name` is omitted, it upgrades every
  instance the host marks as eligible. The command does not replace healthy local sources or change
  whether an extension is enabled.
- Catalog entries marked `default` are installed for new projects. Catalog membership alone does not
  make an extension a default. The packaged catalog defaults to the harnesses, base themes, and
  Prompt Studio skills.
- An adopted extension whose `engines.pstdio` does not match the host is shown as an error in the
  extension list and detail view. The error names both API versions. When the host can replace the
  source with a release, it tells the owner to upgrade; otherwise it tells the owner to fix the source.
- Every load error offers Copy error. Copy error puts the error code and message on the clipboard.
  Catalog extensions that can take a newer release also offer Upgrade. A local extension is fixed in
  its source folder, and **Reload** then adopts the fixed source.
- Dropping an extension folder on the drop zone at the bottom of the extension panel copies it to
  `<repo>/.pstdio/extensions/<folder-name>` and loads it as a repo extension. The dashboard skips
  `node_modules` and `.git`. The host installs the folder the same way `pst extensions add <path>`
  does: it installs dependencies, validates the extension in staging, and moves it into place. It
  refuses a folder without a `package.json`, a file path that leaves the folder, and a folder name
  that already exists under `.pstdio/extensions`. The request is
  `POST /v1/projects/{projectId}/extensions/local` with multipart form data: a `name` field and one
  `files` part per file, whose file name is its path relative to the folder root.

The host reads its packaged catalog unless `PSTDIO_EXTENSION_CATALOG` points to a local JSON file or
an HTTPS URL. Remote catalogs are cached under `$PSTDIO_HOME/cache/extension-catalog`. The catalog is
trusted configuration because every entry names code the host may run.
- Webview bundles are reused across restarts while their inputs are unchanged. Startup checks them
  in the background and does not wait. Editing an installed folder still rebuilds that extension's
  webview assets, so an open webview updates while you work. Only its contributions wait for the
  update, because those are what the project agreed to run.
- Skill files are read from the installed folder. Editing a folder that ships skills or a
  `workspace.provision` hook re-provisions the workspaces of every project that runs it, so agent
  skill folders such as `.agents/skills` match the edit. A write that leaves the folder's content
  unchanged does not re-provision.
- `pst extensions dev <path>` still reinstalls on every edit. That is an explicit development loop,
  not automatic adoption.

## Developing A Repo-Scoped Extension

A repo-scoped extension installs into `<repo>/.pstdio/extensions/<install-name>`, which is often the
folder you are already editing. Point `pst extensions dev` at that folder and it is validated where
it is. Nothing is copied, replaced, or deleted, so untracked and ignored files in the folder survive
a refresh.

Every refresh republishes what the folder declares now. A command you removed stops being served,
and a command you added is available at once. Only a validated refresh is adopted. A failed refresh leaves the last valid project snapshot active, so command metadata and execution still refer to the same adopted version.

When a refresh fails, the development loop prints the failure and then `no new runtime published for
<name>`. The previous runtime keeps running, the watcher stays attached, and the next edit retries.

## One Provider Per Extension Id

A project runs one source per extension id. Command execution, webview metadata, and the extension
panel all resolve an extension by that id, so a second enabled source claiming the same id would let
them disagree.

- Enabling a source takes the id from whatever held it before. That covers the extension panel,
  `pst extensions add`, and `pst extensions dev`, where you say which copy you want. The source that
  held the id becomes disabled and stays listed, so you can switch back.
- Discovery never takes an id away. When the project folder contributes a folder whose id another
  enabled source already provides, that folder is registered **disabled**. Nothing that was running
  stops running, and you pick the copy you want in the extension panel.

This matters when a project folder carries a copy of an extension you already installed for your
user. The copy you were already running keeps the id until you say otherwise.

The extension detail view shows the source folder of each installed extension, which is what tells
two copies of the same extension apart.

## Changing The Extension API

[API versioning](0014-api-versioning.md) defines the change levels, the one-step-per-release rule, and how to deprecate and remove APIs. Bundled extensions and the host still move together: update every first-party extension and its manifest before a breaking release. `bun run verify:extension-api-version` lists any tracked manifest the host would refuse. See [release versioning](../../requirements/platform/0005-versioning-and-releases.md) and [PR separation](../../guides/development/0004-pull-request-labels.md).

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
theme id         pstdio.planner.theme.<local-id>
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

This manifest is illustrative. The built-in Planner package is named `pstdio-planner`,
so its extension ID is `pstdio.pstdio-planner`. Its `list-tickets` command resolves
to `pstdio.pstdio-planner.command.list-tickets`.

When another extension needs a public command, the provider owns and exports that contract from one module:

```ts
import { commandRef } from "@pstdio/sdk/extensions";

const plannerCommand = commandRef.forExtension({ publisher: "pstdio", name: "planner" });

export const plannerCommands = {
  publish: plannerCommand<{ version: string }, { published: boolean }>("publish"),
};
```

Consumers import `plannerCommands.publish`. They do not repeat the provider identity or rebuild runtime ids.
