# Manifest and installation

Every extension is a package with a `package.json` manifest and an entry file. This page covers manifest fields, installs, updates, and IDs.

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
    "pstdio": "^0.1.0 || ^0.2.0"
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

`pst extensions check` asks the API host to check its user and repo-local roots. Run it inside a linked project. Use `--scope repo` or `--scope user` to check one host root. Errors outside the selected scope do not affect the result. Repo scope requires a local default workspace.

`pst extensions check <path>` checks a local source folder for authoring. It does not install files or start the API. It compares `engines.pstdio` with the extension API version built into the `pst` you ran, not with your runtime's version. See [which version each check uses](0014-api-versioning.md#which-version-each-check-uses).

Both forms start with a header that names what was checked and which versions were compared:

| Line | Source check (`<path>`) | Installed check |
| --- | --- | --- |
| `Checked:` | `source folder <absolute path> (not installed, so no host took part)` | `extensions installed on the host at <API URL> for project <id>` |
| `This pst:` | Extension API, `pst`, and SDK versions of the `pst` you ran. | The same versions. The host checks `engines.pstdio` with its own extension API version, which it does not report yet. |
| `Manifest engines.pstdio:` | The range in the source's `package.json`, or `not declared`. | Not printed. A range the host rejects appears as a diagnostic. |

When a source check rejects the manifest range, the error says `this pst provides <version>` instead of `this host provides`. The host's own checks keep the host wording. If your runtime is a different release than that `pst`, the error describes the tool, not the extension: use the `pst` from the runtime's release, or install the extension and run the installed check.

`--json` uses one envelope with a different result key for each form:

| Key | Source check | Installed check |
| --- | --- | --- |
| `target` | `{ "kind": "source", "path" }` | `{ "kind": "installed", "projectId", "host" }` |
| `versions` | `cli`, `extensionApi`, and `sdk` of the `pst` you ran, plus `manifestRange` | `cli`, `extensionApi`, and `sdk` of the `pst` you ran |
| Result | `check`: the local checker's report, including the resolved `runtime` | `checks`: one entry per host root, each with `scope` (`user` or `repo`), `extensionsRoot`, `errorCount`, `warningCount`, `diagnostics`, and `hostCompatibility` |

`versions.extensionApi` is never the runtime's version. Compatibility status and errors are reported for each checked root.

| Component | Version source | Compatibility rule |
| --- | --- | --- |
| CLI | Installed `pstdio` package | Owns the bundled runtime and dashboard release. |
| Extension API | `EXTENSION_API_VERSION` | Must be included in the caret ranges declared by `engines.pstdio`. |
| SDK | `SDK_VERSION` from `@pstdio/sdk/extensions` | Shares the public fixed release group; its package number is separate from the host contract version. |
| Dashboard capabilities | The capability table that ran the check | Each declared contribution must have a supported host capability. |

An extension that targets an older API is repaired where it comes from. A catalog extension is
upgraded to its build for this host. Any other extension is fixed in its source folder: update the
code for this API, add a caret range for the host's API version to `engines.pstdio` in its
`package.json`, then reload it. An extension that requires a newer API needs a newer Prompt Studio release or an extension build
for this host.

## Installing And Updating

Installs and updates are explicit. Source that appears in the extensions root is never adopted on its own.

Packaged builds include their host catalog extension sources and lockfiles. These install from the app's bundled packages and retain the build's source commit. Registry packages and local folder installs also work without Git.

Explicit Git refs and other repository sources use the system Git executable. When Git is missing or cannot run, Git workspaces are unavailable and explicit Git operations report that Git is required. On macOS, the host checks the selected developer tools before invoking Apple's Git stub, so normal startup does not open the developer-tools installer.

- `pst extensions add <name>` resolves the name through the extension catalog. The catalog entry
  names the Git repository, folder, and release ref. Prompt Studio records the resolved commit with
  the install, so the installed source stays pinned even when a tag or branch moves.
- `pst extensions add <name> --branch <branch>` installs from a branch instead. A branch moves, so
  this is for extension development only. The host release chooses the default ref, even when the CLI runs a different version.
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
- Dropping a folder and `pst extensions add <path>` upload source to the API host. Both follow the manifest scope: user extensions go to the host's `$PSTDIO_HOME/extensions/<name>`; repo extensions go to its `<project>/.pstdio/extensions/<name>`. Both need a linked project. Dependencies and ignored files are excluded; `.git` is preserved. The host installs dependencies, validates in staging, enables the result, and provisions workspace skills.
- An existing install is refused unless `--force` is set. The dashboard asks before replacing it. Replacement affects every project using that installed source. A failed validation leaves the installed files intact.
- The shared request is `POST /v1/projects/{projectId}/extensions/install`. JSON uses `{ source: { kind: "catalog", name, ref? }, installName?, force?, skipInstall? }`. Multipart uses `kind=upload`, `folderName`, one `files` part per relative file path, and optional `installName`, `force`, `skipInstall`, and `development` fields. Boolean form fields use `"true"` or `"false"`. A successful response is HTTP 201 with `{ source, extension }`.
- `client.extensions.install(projectId, request)` and `client.extensions.install(projectId, { upload: formData })` use that route. A host-owned project source can use `{ source: { kind: "project-folder", path: "relative/folder" } }`. Paths must stay inside the host's local default workspace, including through symlinks.
- Webview bundles are reused across restarts while their inputs are unchanged. Startup checks them
  in the background and does not wait. Editing an installed folder still rebuilds that extension's
  webview assets, so an open webview updates while you work. Only its contributions wait for the
  update, because those are what the project agreed to run. If an extension fails to load, for
  example before its dependencies are installed, a webview request loads it again once its
  `package.json`, the files its entry imports, or its installed dependencies change. Reload always
  loads it again. A restart is not needed.
- Extension contribution modules are bundled in the managed runtime cache in development and
  packaged hosts. Dependencies use their published exports, independently of the host's development
  import conditions. Package asset URLs still point to the installed source files.
- Each webview build runs in a new Bun process, so a build after an update reads the dependencies
  that the update installed ([ADR 0070](../../adrs/0070-temporary-build-extension-webviews-in-a-child-process.md)).
  A webview request also rebuilds a bundle whose published module is missing, for example after its
  cache folder was removed. A webview request does not retry a failed build until the build's inputs
  change. Reload, a new install, or a change in the extension's folder builds it again.
  Reload waits for the current result even when a watcher started the build. A failed current build
  shows its error instead of the previous bundle. A result for a removed or replaced view is discarded.
- Skill files are read from the installed folder. Editing a folder that ships skills or a
  `workspace.provision` hook re-provisions the workspaces of every project that runs it, so agent
  skill folders such as `.agents/skills` match the edit. A write that leaves the folder's content
  unchanged does not re-provision.
- `pst extensions dev <path>` watches the author’s local files and sends changed source to the host. The host reuses installed dependencies when their inputs match, reinstalls changed dependencies, and reloads the extension.
- Dependency installs never run package code. The host runs
  `bun install --frozen-lockfile --ignore-scripts`, adding `--production` for normal installed copies. Development refreshes also install development dependencies.
  Lifecycle scripts (`preinstall`, `postinstall`, `prepare`) do not run, for the extension or for any
  dependency, and `trustedDependencies` does not change that. An extension that needs a build step
  must ship the built files. When the source has a `bun.lock`, the install uses exactly what it names
  and fails if it no longer matches `package.json`; run `bun install` in the source folder and keep the
  updated lockfile. A source without a `bun.lock` resolves from `package.json`, and no lockfile is
  written. The host checks `package.json` before it installs anything. It imports the entry to
  validate it only after the install.

The host reads its packaged catalog unless `PSTDIO_EXTENSION_CATALOG` points to a local JSON file or
an HTTPS URL. Remote catalogs are cached under `$PSTDIO_HOME/cache/extension-catalog`. The catalog is
trusted configuration because every entry names code the host may run.

The host records the commit it cloned, but it does not yet check that commit against an expected
value, and it does not check a signature on remote catalogs. PS-528 adds both.

## Trust

An installed extension runs inside the API process with the access of the user's account. It can read
files, the host environment, and stored connection secrets. The process isolation model is in
[ADR 0058](../../adrs/0058-isolate-extension-backends.md).

Repo extensions are discovered and enabled when a project opens, and their entry code runs at that
point. User extensions stay disabled until someone enables them. The planned trust step, which reads
only `package.json` until a person approves the folder's content hash, is in
[ADR 0059](../../adrs/0059-trust-step-for-repo-extensions.md).

## Developing A Repo-Scoped Extension

A repo-scoped extension installs into `<repo>/.pstdio/extensions/<install-name>`, which is often the
folder you are already editing. When the API is on the same machine and owns that same folder, `pst extensions dev` validates it in place through the host route. Untracked and ignored files survive. Against a remote API, the local source is uploaded into the host’s installed copy.

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

[API versioning](0014-api-versioning.md) defines the change levels, the one-step-per-release rule, and how APIs are deprecated and removed. When a release breaks the API, update your extension's code, then add a caret range for the new API version to `engines.pstdio`. When a release only adds APIs or fixes behavior, your existing range keeps working.

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

On `main` (planned extension API 0.3.0, after 0.45.0), the host catalog may mark an entry
`alwaysEnabled: true`. That installed user extension is enabled during discovery
for every existing and new project. Project disable, uninstall, and replacement
with another provider of its extension ID are refused. Ordinary catalog defaults
remain optional. The flag belongs to the host catalog, not `package.json` or
`defineExtension()`, and does not apply to a repo-local copy with the same name.
If the catalog cannot be read, no extension counts as required until it loads.
See [app-wide settings](0004-contribution-api.md#app-wide-settings) for settings
panel placement and device storage.

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
artifact root    <repo>/.pstdio/extension-storage/pstdio.planner/
theme id         pstdio.planner.theme.<local-id>
```

Use the package `name` anywhere extension-facing code needs a short project scope.
Publisher-qualified runtime ids are host routing details. Extension code declares local ids and uses typed refs.
For same-extension composition, use the `ref` returned by `defineCommand()`.

Every local contribution id follows one grammar: lowercase kebab-case segments separated by single dots, matching
`[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*`. Dots express local grouping (and derive default CLI paths
for commands): `ticket-status.create` becomes `pst <extension> ticket-status create`. Ownership never lives in the id:
a ref's `extensionId` carries it. `pst extensions check` rejects ids outside the grammar with the code
`extension_contribution_id_invalid`. Host-published refs (for example `workbenchPages.start`) resolve to the
host's registered id without owner prefixing, for every contribution kind; runtime ids such as
`pstdio.planner.command.tickets.create` are opaque routing values that no code may split back into parts.
`contributionRefId(ref, ownerExtensionId?)` and `commandRefId(ref, ownerExtensionId?)` from `@pstdio/sdk/extensions`
are the one implementation of this rule; a ref without `extensionId` belongs to the owner, or to the host when there is none.

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


## Client and host files

Installing never writes extensions or agent skills into the CLI machine's home. The host provisions local workspace skills. Install global agent skills separately with `pst agents install-skills` on the agent's machine.

Uploads omit `node_modules` and include confined source links as file content. `--skip-install` skips host dependency installation and can reuse matching dependencies already installed on the host. For a local API, CLI sources inside the host's local project use the project-folder input, preserving existing host dependencies and sibling packages. Uploads cannot reuse dependencies that exist only on another machine. `pst extensions test --project-path <context>` preserves dependency context in its private host.

## Extension versions in cloud projects

A cloud project's extension set is normal project data. It is stored as records of the
platform owner `pstdio.published-extensions`. One record per extension holds the selected
package revision and the enabled state. Package metadata and bytes live in immutable
`package:<sha256>` records with the package as their file. Like other records, each one is
its own document ([ADR 0100](../../adrs/0100-one-document-per-resource.md)), and they
sync through the owner's encrypted record stream
([ADR 0102](../../adrs/0102-record-stream-sync.md)). Each package travels as an encrypted
blob before the save that uses it. The relay cannot read extension names, versions or
code.

Installing, editing and reloading a source stay local. Explicitly publish a portable
source when other devices should use it:

```sh
pst extensions publication list --project-id <project-id>
pst extensions publication publish <install-name> --project-id <project-id>
```

The result first reports `saved-locally`. Offline edits merge when the device
reconnects. Concurrent publications choose the same package on every device. Package
metadata stays attached to its bytes; an enable edit can merge with a publication.
`--expected-revision` checks the catalog value that the caller inspected.

A new device discovers the set even before it has installed an extension. It downloads
and verifies all selected packages, installs frozen runtime dependencies, and validates
sources, resource prefixes and webviews before switching the whole set in one database
transaction. This work runs in the project's background sync connection; showing the
enabled extensions reads only local rows. Workspace setup runs afterward through the
normal workspace setup queue; its failures belong to the workspace setup status. A failed
transfer or activation keeps the previous usable set. A set that fails to activate is
tried again at once when it changes, and otherwise after a delay that grows from 30
seconds to one hour.
Interrupted encrypted downloads resume from their durable byte offset.

Packages include portable source and assets. They omit dependency directories, checkout
metadata, `.pstdio`, environment files and standard package-manager credentials. Source
links are rejected. Runtime dependencies require a frozen `bun.lock`. Publish packages
whose dependencies can be installed independently; machine paths and credentials stay
local.

Repo-local sources and unpublished edits of a published extension are private
overrides. Catch-up preserves their code. Their record and artifact edits still sync,
but their data migration callbacks do not run. Only the selected, unmodified synced
package can run data migrations. A skipped migration is not recorded, so the synced
version still runs it. An older package can read shared data but cannot change it until
updated. This also applies to file uploads and artifact writes. A selection whose package
cannot be read blocks writes and migrations the same way until it is repaired. Extensions
that are not published keep normal migration behavior. So do published extensions in
projects that the device knows are not cloud projects; while its cloud project list has not
loaded, the override rules apply. See [data migrations](0018-data-migrations.md).

To replace a private override with the selected package, or select a retained package:

```sh
pst extensions publication adopt <extension-id> --project-id <project-id>
pst extensions publication rollback <extension-id> --revision <package-sha256> --project-id <project-id>
pst extensions publication disable <extension-id> --project-id <project-id>
pst extensions publication enable <extension-id> --project-id <project-id>
```

Adoption preserves the instance, storage owner and settings. The previous source folder
stays available. Rollback changes the selected code; it does not undo data migrations.
Rollback, enable and disable first apply the changed set on this device. A change this
device cannot apply is not shared. Rollback also repairs a selection whose package cannot
be read. All published extensions share their enabled state; a local enable is shared only
after this device accepts it. Uninstalling a published extension removes it from the set
on every device. Uninstalling an older copy that this device does not run keeps it in the
set. When several copies share an extension ID, `publish` uses the enabled copy. Automation scheduling still follows its device
assignment; publication does not move execution to another device.

Agents and clients use the same API: `GET` and `POST
/v1/projects/{projectId}/extension-publications`. POST accepts `kind: "publish"` with
`instanceId` and `expectedRevision`; `kind: "adopt"` with `extensionId`;
`kind: "rollback"` with `extensionId`, package `revision` and `expectedRevision`;
or `kind: "enabled"` with `extensionId`, `enabled` and `expectedRevision`.
