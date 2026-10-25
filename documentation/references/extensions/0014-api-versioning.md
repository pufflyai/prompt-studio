# API versioning

The extension API has its own semver version. This page explains version ranges, breaking changes, and how old APIs are retired.

The decision is recorded in [ADR 0047](../../adrs/0047-semantic-versioning-for-the-extension-api.md).

## App, SDK, and extension API versions

Three version numbers matter when you build or install an extension. They answer different questions.

| Version | What it is | Where to see it |
| --- | --- | --- |
| App version | The Prompt Studio release you run: the desktop app, the `pstdio` CLI, and the runtime and dashboard inside them. Core extensions install from the same release. | **Help** at the bottom of the dashboard sidebar shows the version of the running runtime. `pst --version` shows the version of the `pst` you ran. |
| SDK package version | The `@pstdio/sdk` package in your extension's `package.json`. It gives your code its types and helpers. | `version` in `node_modules/@pstdio/sdk/package.json`. |
| Extension API version | `EXTENSION_API_VERSION`, the extension contract that a host supports. Your manifest's `engines.pstdio` names the API versions your extension works with. | `pst extensions check` prints the API version of the `pst` you ran. The runtime's version is not printed; find it from the app version. `@pstdio/sdk/extensions` exports the constant. |

The app and the SDK are released together with the same number. The extension API has its own number, because it changes only when the contract changes. For example, release 0.43.1 ships extension API 0.1.6.

The host decides what loads. It compares its own extension API version with `engines.pstdio`. Updating `@pstdio/sdk` in your extension does not update the app. A newer SDK can compile code that calls APIs your app does not have yet.

### Versions in current releases

| Release | Extension API | Notes |
| --- | --- | --- |
| 0.43.1 | 0.1.6 | Use ranges such as `^0.1.0`. A manifest that needs `^0.2.0` does not load. |
| 0.44.0 | 0.2.0 | A breaking step. See [Extension file storage in API 0.2](#extension-file-storage-in-api-02). |
| 0.45.0 | 0.2.1 | Adds [independent panel permissions](#independent-panel-permissions-in-api-021) and the `/client` device login methods. Existing `^0.2.0` ranges still load. |
| `main` | 0.2.2 | Adds account feature grants, full project-scoped `ctx.sessions` operations, indexed record queries and batches, optional paged collection views, device performance capture and Developer settings contributions, project recovery methods on `/client`, and always allows Kanban dragging. Existing `^0.2.0` ranges still load. |

Pages that describe APIs from `main` say so and name the first release that has them.

### Which version each check uses

| Check | Where it runs | Extension API version it compares with |
| --- | --- | --- |
| `pst extensions check <path>` | Inside the `pst` you ran. It does not contact the runtime. | The API version built into that `pst`. Its error says "this pst provides" that version. On 0.43.x it says "this host provides", even when your runtime is a different release. |
| `pst extensions check` with no path | The connected runtime checks its installed user and repo extensions. | The runtime's API version. The version lines at the top come from the `pst` you ran, not from the runtime. |
| `pst extensions add`, dashboard install, **Reload**, and **Upgrade** | The connected runtime. | The runtime's API version. |
| `tsc` in your extension folder | Your computer. | None. It checks your code against the `@pstdio/sdk` types you installed. It cannot tell whether your app has those APIs. |

`pst extensions check` never reports the runtime's own app or extension API version. Read the app version in **Help**, then find its extension API version in [Versions in current releases](#versions-in-current-releases).

From the release after 0.43.x, the check output names what it checked:

| Check | Text output | `--json` |
| --- | --- | --- |
| `pst extensions check <path>` | `Checked: source folder <path>`, then `This pst: extension API <version> (pst <version>, SDK <version>)` and `Manifest engines.pstdio: <range>`. When the range rejects this `pst`'s API version, a last line explains what to do. | `target: { kind: "source", path }`, `versions: { cli, extensionApi, sdk, manifestRange }`, and the result in `check`. |
| `pst extensions check` with no path | `Checked: extensions installed on the host at <URL> for project <id>`, then the `This pst` line and one section per scope. | `target: { kind: "installed", projectId, host }`, `versions: { cli, extensionApi, sdk }`, and one result per checked folder in `checks`, each with its `scope` (`user` or `repo`). |

In 0.43.x, the installed check prints `CLI`, `Extension API`, `SDK`, and `Dashboard (bundled)` lines, which all describe the `pst` you ran. The source check prints only the result in text mode. Its `--json` has `versions` with a `dashboard` field, and the result in `check`. Installed `--json` has no `target`, and its `checks` entries have no `scope`.

When the `pst` you run and the runtime come from the same install, these checks agree. The desktop app includes its own `pst`. If you also installed `pstdio` with Bun, `command -v pst` on macOS and Linux, or `where.exe pst` on Windows, shows which one runs.

### Align the app and your tools

1. Find the app version in **Help**, or with `pst --version` from the same install.
2. Install the matching SDK in your extension folder, for example `bun add @pstdio/sdk@0.43.1`. Its types then match the APIs your app has.
3. Declare an `engines.pstdio` range that includes the app's extension API version, such as `^0.1.0` for API 0.1.6.
4. After you update the app, restart the runtime so the new version runs. Quit and reopen the desktop app. If you started the runtime from a terminal, run `pst close` and then `pst`.

Do not widen `engines.pstdio` to make a check pass. A range is a promise that your extension works with that API version. Add a range only after you ran the extension on a host with that version. If a check says your extension needs a newer API, update Prompt Studio, or use only the APIs your release has.

## Host version

`EXTENSION_API_VERSION` is a plain semver number with no prerelease or build tag. `@pstdio/sdk/extensions` exports it, and `pst extensions check` prints it.

The version stays on `0.x` until the maintainers declare the API settled. That release sets it to `1.0.0`. Semver defines major version zero as initial development, so the leading `0` tells authors that the API may still break.

## `engines.pstdio` declaration

An extension declares one or more caret ranges joined by `||`:

```txt
declaration = term *( "||" term )
term        = "^" MAJOR "." MINOR "." PATCH
```

Whitespace around `||` is allowed. Numbers follow semver rules, so leading zeros are refused.

| Declaration | Result |
| --- | --- |
| `^0.1.0` | Valid. |
| `^0.4.2` | Valid. Needs API 0.4.2 or newer, below 0.5.0. |
| `^0.4.2 \|\| ^0.5.0` | Valid. One build for two breaking lines. |
| `^1.2.0` | Valid after `1.0.0`. Needs API 1.2.0 or newer, below 2.0.0. |
| `0.4.0` | Refused. An exact version pins one host release. |
| `~0.4.0`, `0.x`, `*`, `>=0.4.0` | Refused. |
| `1.0.0-alpha.14`, `^1.0.0-alpha.1` | Refused. Prerelease tags are not accepted. |

Only caret ranges are accepted because each one stops below the next breaking version. On `0.x` that is the next minor. From `1.0.0` it is the next major. A declaration can never claim support for a breaking version that did not exist when it was written. Exact versions and tilde ranges would force an edit after each additive release.

The host accepts an extension when `Bun.semver.satisfies(EXTENSION_API_VERSION, declaration)` is true. The parser lives in [`api-versions.ts`](../../../packages/pstdio-api-contracts/src/extension-kernel/api-versions.ts). The runtime and `pst extensions check` both use it.

## Diagnostic

A refused extension gets one `extension_manifest_unsupported_api_version` diagnostic. The message names the extension, its declaration, and the host version, then gives one repair:

| Case | Repair |
| --- | --- |
| The declaration is not caret ranges | Shows the accepted form, with `^<host>` as the example. |
| Every term's minimum is below the host, catalog source | Upgrade the extension to its build for this host. |
| Every term's minimum is below the host, other source | Make it work with API `<host>`, then add `^<host>` to `engines.pstdio`. |
| Otherwise, the extension needs a newer API | Update Prompt Studio, or use an extension build for this host. |

## Keep an extension compatible

Declare a caret range that starts at the lowest API version your extension needs, such as `^0.1.0`. The extension then keeps loading across additive and fix releases. Raise the minimum only when the extension starts using a newer API.

On `0.x`, a new minor version is a breaking release. When one arrives, update the extension's code for the new API. Then declare `^0.1.0 || ^0.2.0` if one build supports both versions, or `^0.2.0` if it supports only the new one.

## What counts as the extension API

Anything an extension author writes code or manifest content against:

- Types and runtime contracts of the public SDK subpaths listed below.
- Manifest fields: `package.json` identity fields, `engines.pstdio`, and the `pstdio` metadata block.
- Contribution validation rules that the host and `pst extensions check` apply.
- Webview bridge capabilities and payloads.
- Command, middleware, hook, and event payloads that the host sends or accepts.
- Documented runtime behavior that extensions rely on, such as what the host does with a command result.

## Public SDK subpaths

Every public subpath follows the same change levels and deprecation window. The API report covers
all of them. Public means a supported consumer outside this repository may import it; usage by an
extension is not the only test. In particular, Granite uses `/client`, and published UI and
workbench packages use `/api` and `/resources`.

| Subpath | Status | Purpose |
| --- | --- | --- |
| `/extensions` | Public, reported | Extension definitions, contexts and typed webview clients. |
| `/extensions/react` | Public, reported | React helpers for extensions. |
| `/testing` | Public, reported | Test contexts and in-memory service implementations. |
| `/data` | Public, reported | Pure frontmatter, draft-layout and name helpers. |
| `/prompts` | Public, reported | Prompt rendering helpers. |
| `/client` | Public, reported | Typed HTTP clients for agents, scripts and hosts. |
| `/api` | Public, reported | HTTP request/response and terminal transport contracts. |
| `/resources` | Public, reported | Shared resource records, including assets and notifications. |
| `/hooks` | Host-only, deprecated in 0.44 | Old filesystem-hook contexts. Use typed hooks from `/extensions`; removal is planned for 0.45. |

The report entry inventory is `packages/sdk/api-report-entries.json`. Adding a public subpath also
adds it there. `/testing`, `/data`, `/prompts` and `/client` are versioned APIs even when a change
has no manifest or bridge effect. A missing in-repo caller does not permit removal of a published
method. Deprecate it first, then remove it in the next breaking release.

`/resources` owns shared asset and notification type names. The older `/client`, `/api` and
`/extensions` paths keep deprecated aliases through 0.44. `/api` owns the renderer terminal
adapter; the separate extension terminal bridge is deprecated with the typed webview cleanup.

Host routing, event resolution, capability tables and artifact mount normalization belong to
`pstdio-api-contracts`. Hosts import them there. Their old `/extensions` exports are deprecated
aliases through 0.44. Keyboard forwarding is a private guest operation; an extension cannot
declare it or invoke it through the public typed capability union.

The dashboard uses the typed HTTP client. Only transport URL resolution (such as its terminal
WebSocket) remains outside that client; dashboard code does not build paths for JSON requests.

## Change levels

Direction matters. The host provides some types, such as `ctx` and `HarnessEventSink`, and extensions call them. Extensions provide other types, such as contributions, handlers, and harness adapters, and the host calls or validates them.

Breaking:

- Remove or rename an export, member, contribution key, capability, or event.
- Change a type so that old code no longer compiles or old values no longer validate.
- Add a required field to anything extensions provide.
- Add a validation rule that refuses a manifest or contribution that loaded before.
- Change documented runtime behavior that extensions rely on.
- Remove APIs that were deprecated in an earlier release.

Additive:

- Add an export, a `ctx` method, a capability, an event, or a contribution kind.
- Add a member to an object the host provides.
- Add an optional field to anything extensions provide.
- Mark an API as deprecated. The old API keeps working until a breaking release removes it.

Fix:

- Fix host behavior so it matches the documented contract, with no type change.

No change:

- Documentation, comments, and internal changes that change neither the public types nor behavior.

If in doubt, it is breaking. A breaking change released as additive lets broken extensions load and then fail one contribution at a time.

| Level | On `0.x` | From `1.0.0` |
| --- | --- | --- |
| Breaking | Minor, `0.4.2` to `0.5.0` | Major, `1.4.2` to `2.0.0` |
| Additive | Patch, `0.4.2` to `0.4.3` | Minor, `1.4.2` to `1.5.0` |
| Fix | Patch, `0.4.2` to `0.4.3` | Patch, `1.4.2` to `1.4.3` |

## One step per release

The version moves at most one step between two releases. The highest change level merged since the last release sets the step. The number of changes does not matter. For example, a release with several additive changes and one breaking change moves the API one breaking step, from `0.4.2` to `0.5.0`.

The only exception is the release that declares the API settled. It moves any `0.x` version to `1.0.0`.

## Deprecate first, remove together

Extensions depend on the API, so an API is never removed in the release that replaces it:

1. Add the new API next to the old one. That is an additive change.
2. Mark the old API `@deprecated` and name the replacement.
3. Remove deprecated APIs together in one breaking release, either one that already breaks the API or one planned for the removals. List each removal and its replacement in the release notes.

Repository checks enforce these rules: each tracked manifest must accept the host version, and the API version must move when the public API report changes.

## Optional queued-input capability

The optional `HarnessSession.steer` capability and host-provided `ctx.sessions` queue methods are additive. Existing adapters keep loading without steering. These additions shipped in API 0.1.2. Publish the SDK contract before adopting it in harness extensions.

## Extension file storage in API 0.2

API 0.2 shipped in 0.44.0. Release 0.43.x provides API 0.1.6 and the old layout.

API 0.2 moves `ctx.extensionFiles` from `.pstdio/ext/<publisher>.<name>/` to `.pstdio/extension-storage/<package-name>/.publishers/<publisher>/`. Publishers with the same package name keep separate files. Artifact mount paths cannot start with the reserved `.publishers` segment, including case variants. This is a breaking filesystem layout change; relative file operations stay the same. Move existing allocated files using the [storage migration guide](../../guides/extensions/0009-allocated-extension-files.md). Extensions that work with both layouts can declare `^0.1.0 || ^0.2.0`.

Prompt Studio 0.46 roots extension storage at
`.pstdio/extension-storage/<publisher>.<name>/`. Relative file operations stay
the same. 0.46 starts with an empty database and does not move or read earlier
`<package-name>/` folders, so each extension starts fresh. Extensions that build
storage paths themselves must use the full-ID folder. Name-only CLI namespaces
and resource-kind references remain deprecated aliases when unambiguous;
full-ID forms replace them. Declared global aliases keep their short form.

## Independent panel permissions in API 0.2.1

API 0.2.1 also adds optional `HarnessProvider.releaseSession(ctx, { sessionId })` for host-managed idle-resource cleanup. The host retains open tabs, active work, and sessions used within 30 minutes. Return `true` after releasing idle resources and `false` while native work or delivery remains uncertain. Preserve history and recreate resources on the next call. Existing providers keep working. Publish the SDK and host before separately released harnesses adopt it.

`ModeRegionSettings` adds optional `canOpen`, `canClose`, `acceptsTabs`, `movable`, `resizable` and Side `floatable` permissions. `floatingPanels` and panel `collapsible` are deprecated, with their old behavior retained. Published extension header and tab behavior stays compatible until the coordinated breaking release. Publish the SDK and host before separately released extensions use these additions.

## Local editing sessions in API 0.2.1

The additive `editing.session` capability and `client.editing.open` share local document edits
across isolated webviews before persistence completes. The host scopes sessions to their project
and extension. See [local editing sessions](0005-webview-and-storage-api.md#local-editing-sessions).
This is on `main` and ships after 0.44.0. Existing public APIs remain available.

## Storage conflict members deprecated in API 0.2.1

Edits from several devices are moving to automatic merging. The storage API stops promising conflicts. These changes are additive and ship in the release after 0.44.0:

- `StorageSaveOutcome` adds `state`: `saved-locally`, `waiting-to-sync`, `synced`, `offline`, or `needs-attention`. `records.commit` and `records.outcome` return it. The host always sets `state`, so a hand-written test double of an outcome must add it.
- `expectedRevision` on a `records.commit` edit is optional. Without it, the edit applies to the record's current value.
- `records.conflicts`, `records.inspect`, `records.resolve`, the `branch` argument of `records.read`, the outcome's `status`, `checkpoint`, `conflictId` and `conflictRevision`, and the `StorageConflict`, `StorageConflictInspection` and `StorageResolution` types are deprecated.
- `storage.assets` no longer documents retained versions or unresolved alternatives.

The next breaking release removes the deprecated members together. See [Deprecated conflict members](../sdk/0004-storage.md#deprecated-conflict-members).

## Storage IDs and positions in API 0.2.1

`storage.ids.create()`, `storage.positions.between()`, and the second migration
callback argument, `migration.id(key)`, are additive. Existing migration callbacks
keep working. The test storage options add optional `workbenchId`, `extensionId`,
and `deviceId` values for simulating the same owner on two devices. These additions
ship in the release after 0.44.0. See the
[storage guide](../../guides/sdk/0003-storage.md#create-records-and-arrange-items).

These ID helpers also accept an optional lowercase prefix. A supplied prefix selects
a lossless 22-character Base62 UUID body; omitting it keeps canonical UUID text.
`resources.allocate({ kind, idPrefix? })` uses the same generator and preserves its
existing UUID output when `idPrefix` is omitted. Compact IDs are case-sensitive;
extension adoption must keep ID lookup exact and shorthand lookup separate. These
options do not rewrite existing IDs or change existing shorthand declarations.

## Personal device references in API 0.2.1

Workspace/session read results and resource references may include `device: { ownerId, id, name }`. A synced record is readable on its owner's other devices. Execution stays on its source device. Shared personal references contain only owner and device details; another user cannot open the underlying record. This additive field ships in the release after 0.44.0.

## Cloud account and sync status in API 0.2.1

`ctx.account`, the `account.read` and `account.manage` webview capabilities, `client.account` on the typed webview client, and the `accountEvents.projectSyncChanged` host event are additive. They ship in the release after 0.44.0. The `/client` account methods add `cancelLogin` and `projectSyncStatus`. `AccountDevice` adds `online`, `AccountStatus` adds `cloudProjectsLoaded`, and `DeviceLogin` adds an optional `email`. `makeCommandContext` from `@pstdio/sdk/testing` provides a signed-out account whose projects are `local`. Publish the SDK and host before separately released extensions use these additions. See [Cloud account and sync status](0003-command-and-process-api.md#cloud-account-and-sync-status).

## Kanban dragging in API 0.2

Every board column allows cards to be dragged in and out. This includes groups for missing or unknown values. `canDragIn` and `canDragOut` remain as deprecated input fields, but their values are ignored. Remove these fields from column configurations. This alpha change stays on the `0.2` API line; manifests need no new version range. The next coordinated removal of deprecated APIs can remove the fields themselves.

## Paged collection views in API 0.2.2

`dataTable` and `kanban` view bodies can opt into `queryMode: "paged"`. Their
query input adds an optional `page` request, and their result adds optional page
revision, cursor, count, group, and statistics metadata. Both additions are
required only for opted-in providers. Existing providers keep their full-result
contract. Storage queries also accept optional `offset` and expected `revision`
for direct page jumps. This shares the next compatible release step with indexed
storage queries; it does not add another API version step before that release.
See [paged tables and boards](0004-contribution-api.md#paged-tables-and-boards).

## Project recovery in API 0.2.2

The `/client` project methods add `recoveryPoints(projectId)` and `restore(projectId, input)`.
The `/api` entry exports `ProjectRecoveryPoint`, `RestoreProjectInput` and `RestoreProjectResult`.
Agents use them to list and restore the same recovery points as project settings. These
additions ship in the release after 0.45.0. See [Restore project data](../../guides/concepts/0006-restore-project-data.md).
