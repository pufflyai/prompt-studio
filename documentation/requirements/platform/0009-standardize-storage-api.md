# PRD: Standardize extension storage

Status: Proposed. Created: 2026-10-17. This document plans the changes; it does not change the API.

Target release: **Prompt Studio 0.44.0** for the new API, maintained extension migrations and
Artifacts storage changes. Removal of the replaced APIs follows in a later breaking release.
The storage changes are blocked on bounded client storage and isolated synchronization failures.
API consolidation alone does not meet this release requirement.

Extensions currently choose between deprecated structured storage calls, versioned records,
uploads addressed by file IDs, and several filesystem interfaces. Standardize file access,
migrate callers to records and assets, then remove the replaced APIs in a coordinated release.

## Benefits and trade-offs

### How much the API shrinks

After deprecated APIs are removed, the storage authoring surface falls from **11 API families to 3**:
8 fewer, or about **73%**. The migration table below defines the counted families.

| Purpose | Current API families | Proposed API | Count |
| --- | --- | --- | --- |
| Structured data | KV `get/set/delete`, `collection`, `records` | `storage.records` | 3 → 1 |
| Uploaded bytes and files addressed by ID | `storage.files` including collection attachments, direct `ctx.files` methods, `storage.assets` | `storage.assets`, with metadata in records | 3 → 1 |
| Files addressed by path | `artifacts.mount`, `extensionFiles`, `workspaceFiles`, `projectFiles`, `packageFiles` | `files.open` | 5 → 1 |

The count groups related calls; it does not count individual methods or underlying stores.
`storage.scope`, `migrate`, `readLegacy`, sessions, settings and saved views remain outside this comparison.
The five entry points for file paths shrink by **80%**. Shared files, local files, the current
workspace, the default workspace and package files remain explicit choices.

In **0.44**, the three families become the recommended API and maintained extensions adopt them.
The old calls remain available during deprecation. The public surface shrinks when those calls are
removed in the later release; adding `files.open` initially increases it.

### What becomes easier

- A ticket editor and a report editor keep the revision they read and save related records together.
  They can report a stale save without implementing separate overwrite rules for KV and collections.
- A file helper can read a packaged template, write an extension draft or edit workspace source
  through the same relative-path methods. The caller selects the root when opening the handle.
- An attachment and a published HTML revision use the same upload, resume and verified-read API.
  Their names, parent records and display order live in metadata records.
- Publishing an Artifacts revision no longer requires a separate materialized HTML file for every
  historical revision. The revision record identifies the retained bytes; an editable draft keeps its file.
- Host adapters, SDK test helpers and authoring examples support fewer public interfaces.
  The old and new calls reuse the same storage owners during migration.

### Custom use cases we drop or move

Ticket boards, reports, notes, attachments, templates and workspace provisioning remain supported.
The following convenience APIs and file assumptions go away after migration:

| Existing use | Required change |
| --- | --- |
| Save a key with `set(key, value)` without keeping the revision from the editor's read. | Keep the read revision, commit against it and handle a conflict. Blind replacement is removed from the authoring API. |
| Create a named collection and let its API generate IDs, preserve ordering and attach files to items. | The extension defines stable record IDs, stores ordering and parent associations, and uses records and assets. |
| Create and edit documents by file ID through `storage.files` or `ctx.files.createText`. | Store document metadata and an asset reference in an owned record, or edit a file through an explicit root. Replacing asset bytes creates a new immutable version. Existing promised URLs still resolve. |
| Open every published Artifacts revision as a permanent local HTML file. | Read its asset or explicitly export a file. Editing a draft and publishing it creates a new revision. Migrate direct-file consumers before removing redundant files. |

Small extensions will write more code than a bare `get/set` pair requires. They must keep revisions
and handle save outcomes. Extensions that used collection conveniences must own their data schema
and attachment metadata. The shared API continues to provide persistence, transfer and conflict handling.

## Storage design issues that must be fixed

The current implementation retains completed assets without automatic cleanup and downloads assets
from retained history before applying an incoming snapshot. A small file change stores another full
asset version. A missing historical asset can prevent current records and outgoing saves from syncing.
This is a design flaw, not an acceptable cost of a smaller API.

The [capacity and recovery PRD](0010-bound-client-storage-and-isolate-sync-failures.md) records the
versioning boundary, client disk costs, failure cases, required changes and acceptance evidence.
It is part of this plan. The 0.44 storage rollout must provide bounded client storage, safe cleanup,
and progress for unrelated work when an asset is unavailable. Keep local durability, conflict
preservation, published URLs and restore recovery. Do not resolve capacity by silently deleting them.

## Release scope and sequence

The [0.44 version PR](https://github.com/pufflyai/prompt-studio/pull/1078) is open as of
2026-10-17. Keep the following work in the 0.44 release scope:

| Change | Release |
| --- | --- |
| Bound client storage, reclaim safe temporary/orphan data and isolate missing-asset failures. | 0.44.0; prerequisite for the storage rollout. |
| Add `ctx.files.open` with host, SDK, browser and testing support. | 0.44.0 |
| Migrate maintained extensions and authoring examples to records, assets and explicit file roots. | 0.44.0 |
| Store Artifacts' published revision contents through immutable asset references and migrate existing revisions. | 0.44.0 |
| Deprecate replaced APIs and publish the upgrade guide. | 0.44.0 |
| Remove the replaced public APIs and their unused adapters. | A later breaking release, after the deprecations ship. |

The [compatibility rule](../../references/extensions/0014-api-versioning.md#deprecate-first-remove-together)
requires the replacement to ship before removal. Product version `0.44.0` does not set the separate
extension API version; the API report checks determine the required change from the last release.

Extension adoption requires an SDK that is already published. Use this order:

1. Merge the host and SDK contract first, with old APIs still working.
2. Publish a candidate containing that contract through the existing
   [nightly release workflow](0005-versioning-and-releases.md#nightly-builds).
   Use its actual published SDK version; do not invent a candidate version or publish packages by hand.
3. Set each adopting extension's SDK dependency range to include that published candidate and stable
   `0.44.0`. Keep `engines.pstdio` on the separate plain API version. Verify each extension with an
   isolated install from the registry before merging its adoption PR.
4. Complete the capacity and recovery requirements, merge the migrations and run the completion
   checks below before merging the 0.44 version PR.
   Changesets and the existing release workflow version and publish the fixed package group together.

SDK publication and failing adoption checks block this release scope. Planner's existing
[adoption PR 1157](https://github.com/pufflyai/prompt-studio/pull/1157) already has this publication
dependency. Do not bypass `published_extensions`, substitute a workspace SDK, or count blocked
adoption as delivered. The supported nightly publication must succeed before the dependent PRs qualify.

## Proposed API

Keep `ctx.storage.records` for structured data and `ctx.storage.assets` for immutable bytes.
Put path-based file access behind `ctx.files.open(...)`.

```ts
// Save task data with the revision the editor read.
const records = ctx.storage.records;
const task = await records.read(records.id("task-1"));
await records.commit({
  operationId: crypto.randomUUID(),
  edits: [{
    recordId: task.recordId,
    expectedRevision: task.revision,
    replace: { title: "Launch Friday" },
  }],
});

// Write an output that other environments receive.
const outputs = await ctx.files.open({ root: "shared", mount: "outputs" });
await outputs.writeText("launch.html", html);

// Write an extension file that stays in this environment.
const local = await ctx.files.open({ root: "local" });
await local.writeText("draft.md", markdown);

// Edit files in the workspace targeted by this command.
const workspace = await ctx.files.open({ root: "workspace", target: "current" });
await workspace.writeText("README.md", readme);

// Read a file shipped with the installed extension.
const packaged = await ctx.files.open({ root: "package" });
const template = await packaged.readText("templates/report.md");
```

These names and signatures are proposed. The contract PR must resolve their types before adoption.

| Root | Resolves to | Behavior |
| --- | --- | --- |
| `shared`, with a declared mount ID | The current extension's artifact mount | The host journals changes, transfers verified bytes, captures direct edits and refreshes views. |
| `local` | The extension's allocated directory | Files remain with the environment. Preserve publisher isolation and existing ignore rules. |
| `workspace`, with `target: "current"` | The command's target workspace | Read and write project source through that workspace's provider. |
| `workspace`, with `target: "default"` | The project's default workspace | Preserve callers that deliberately edit the default workspace. |
| `package` | The installed extension package | Read-only access. |

All file handles use relative paths. Readable handles expose `exists`, `readText`, `readBytes`,
`list` and `listDirs`. Writable handles also expose `writeText`, `updateText`, `writeBytes`
and `delete`. Workspace handles retain `syncDir` for harness-managed directories.
Preserve the existing path-method return values and the rule that `updateText` fails if absent.
Large transfers continue through the streaming asset API.

The package handle must reject writes through both public types and runtime checks.
Opening a root must resolve its current owner, workspace readiness and provider permissions.
A missing current workspace must not redirect a write to the default workspace.
Do not accept arbitrary absolute roots or caller-supplied ownership claims.

Shared writes retain the existing journal and native editor revision checks. Workspace and local
files retain their provider guarantees. The common interface does not give repository edits
distributed transactions or make external filesystem writers obey revision guards.

## Map existing callers

| Existing API | Replacement |
| --- | --- |
| `storage.get/set/delete` | `storage.records.read/commit` with the caller's observed revision. |
| `storage.collection(...)` | Domain records migrated by the owning extension. Preserve IDs, order and conditional operations. |
| `storage.records` | Keep. |
| `storage.assets` | Keep. |
| `storage.files` and collection attachments | A metadata record with an asset reference and its parent association. |
| Direct `ctx.files` methods taking file IDs | Records and assets after resolving the existing file's owner and references. |
| `ctx.artifacts.mount(id)` | `ctx.files.open({ root: "shared", mount: id })`. |
| `ctx.extensionFiles` | `ctx.files.open({ root: "local" })`. |
| `ctx.workspaceFiles` | `ctx.files.open({ root: "workspace", target: "current" })`. |
| `ctx.projectFiles` | `ctx.files.open({ root: "workspace", target: "default" })`. |
| `ctx.packageFiles` | `ctx.files.open({ root: "package" })`. |

Keep `storage.scope`, `migrate` and `readLegacy` for addressing and migration.
Keep domain APIs such as sessions, settings and saved views with their existing owners.
Record IDs, asset references and published resource URLs remain distinct from filesystem paths.

## Data and ownership requirements

- Bind a file handle to the resolved extension, workbench, environment and workspace. A connection
  switch must not retarget an outstanding operation. Preserve cancellation and read/write checks.
- Reuse the existing journal, asset store, safe-path checks and root resolvers. Old and new names
  must call the same owner. Adding a method name must not create another writable copy.
- Do not move files or change record IDs just because their access method changes.
- Preserve artifact mount declarations, access grants, file-change events and view refresh behavior.
- Keep revisions, asset completion checks, tombstones, retained alternatives and restore recovery.
  A local save must not report relay acceptance.
- Migrate collection data through the owning extension's migration version. Preserve resource IDs,
  ordering, `createIfAbsent` and `deleteIfValue` conditions. Do not turn those conditions into claims
  that an extension holds a distributed lock.
- Guard migration against concurrent old-format writes. Make interrupted migration resumable,
  use stable migration operation IDs, and switch reads after verified conversion. Avoid ongoing dual writes.
- Preserve attachment IDs, names, media types, parent associations and existing download links.
  Resolve old project-wide file ownership from stored references; do not assign an ambiguous file
  to whichever extension first reads it. Leave unresolved files readable through the existing route
  until their ownership is resolved.
- Browser upload, image and download helpers must use the same owner checks and asset references.
  Supply a supported display/download helper before retiring blob URLs. Keep credentials and local
  paths out of portable references. Browser transfers must retain streaming and cancellation.
- Carry the editor's original read revision through save commands. Do not reread and substitute a
  newer revision. Return conflicts before starting processes or other external work. Retry identical
  storage requests rather than replaying commands.

## Implementation order

Steps 0–4 target 0.44.0. Step 5 follows after 0.44.0 has shipped the deprecations.

### 0. Resolve storage capacity and synchronization failures

Specify and prove the [capacity and recovery requirements](0010-bound-client-storage-and-isolate-sync-failures.md)
before extension migrations expand asset use. Publish the storage budgets, retention rules and recovery
evidence. A plan that leaves every client retaining all history indefinitely is not ready for adoption.

### 1. Specify and prove the contract

Create the proposed file-root types and an old-to-new migration guide. Inventory direct calls,
destructured aliases, view bridges, CLI/SDK consumers, test fixtures and authoring examples.
Specify how attachment records are listed and rendered through the existing record/asset owners.

Cover these cases before changing callers: read a packaged template; write a local draft; edit the
current and default workspaces; publish a shared file; upload and render an attachment; save a stale
record; synchronize a shared file between environments. Keep shared-file editing protections in the
contract. Do not claim stronger guarantees for direct external filesystem edits.

Deliverable: public types, the migration map, ownership rules and focused contract evidence.

### 2. Add host and SDK support

Add `open` to the existing `ctx.files` object without changing its old file-ID methods.
Return handles backed by the existing host adapters. Add SDK testing support and align the command,
browser and external client contracts. Reuse the existing file events and transport owners.

Mark replaced context properties and direct file-ID methods deprecated with their replacements.
Keep their behavior during the migration. Update the public API report and release notes.
Publish the SDK before any extension adopts it, following the
[extension API versioning rules](../../references/extensions/0014-api-versioning.md).
For the 0.44 target, publish the contract in a nightly candidate before merging the adoption PRs.

Deliverable: a released SDK and compatible host that run old and new callers against the same data.

### 3. Migrate Notes and Artifacts

Migrate Notes' mounted file access to the shared root and verify native edit conflicts and refreshes.
Migrate Artifacts' source-file reads to explicit workspace roots.

Change Artifacts' published revisions to store metadata and immutable asset references.
Import existing revision files without changing artifact URLs, revision IDs, labels or ordering.
Read older published HTML through its asset reference. Materialize a file only when the extension
actually exposes an editable output. Remove redundant revision files only after verifying their
asset contents, references and any direct-file consumers. Keep source drafts and published revisions separate.

Deliverable: existing Notes and Artifacts data open correctly, and publishing does not require a
separate materialized HTML file for every historical revision.

### 4. Migrate the remaining extensions

Use separate adoption PRs against the published SDK:

1. Planner and Reports: move domain collections, templates and attachments to records and assets;
   move draft file access to explicit roots. Preserve saved views, ticket/report IDs and URLs.
   Keep Planner's grouped saves and checks before starting agent work.
2. Harnesses: preserve workspace provisioning and `syncDir` for `.agents/skills` and `.claude/skills`.
   A provisioning event must still write to its actual target workspace.
3. Skills, Extension Lab and the repository's extensions: migrate their storage calls and examples.

Preserve existing folder locations during API adoption. Any later layout migration needs its own
data requirements. Update create-extension skills and generated examples to teach the new API.
Verify that each adoption PR passes its published-dependency check without an unpublished SDK alias.

Deliverable: maintained extensions and generated examples use the standardized APIs.

### 5. Remove the deprecated authoring APIs in a later release

After a release containing the deprecations and after maintained callers migrate, remove the old
context properties, KV/collection authoring methods and blob/file-ID authoring methods together
in a coordinated breaking release. Keep migration access and resolution of promised persistent URLs.
Remove adapters once their remaining migration and URL readers have been accounted for.

Publish a complete upgrade map for external extensions and update their API version requirements.
Use Changesets and the existing version checks; do not choose or edit release versions by hand.

Deliverable: public authoring documentation and types expose records, assets and selected file roots.

## Dependencies and separate work

Use the latest reviewed storage implementation on main. The native relay connection and shared-file
adapters are in [PR 1165](https://github.com/pufflyai/prompt-studio/pull/1165) and
[PR 1169](https://github.com/pufflyai/prompt-studio/pull/1169). Integrate the file-root adapter with
those owners after their prerequisite branches settle; do not build a second relay client.

Capacity, retention, replay isolation and cleanup may use separate implementation PRs, but they are
requirements for this storage rollout. The linked PRD defines their scope. Any change to protocol
retention must prove returning-client and restore recovery before deleting retained material.

## Completion checks

- Pass the capacity and recovery PRD's checks, including bounded growth, interrupted cleanup,
  missing historical assets, unrelated save progress and returning offline environments.
- Old and new APIs address the same data during migration; interrupted migration preserves it.
- Package files are read-only; traversal, foreign-owner access and unintended workspace fallback fail.
- Default/current workspace selection, read-only and remote providers, provisioning and cancellation work.
- Shared edits reach the other environment, refresh views and preserve stale editor drafts and conflicts.
- Attachment uploads resume, verify bytes and render through authorized browser helpers.
- Existing artifact, ticket and report links and historical revisions still open after migration and restart.
- Notes, Artifacts, Planner, Reports, harnesses, testbench, CLI and browser consumers pass affected checks.
- SDK consumer/type checks, API report/version checks and package boundaries pass. Run the packaged
  verifier for changed runtime inclusion and compiled behavior. Validate affected UI with Playwright.
- Maintained extensions pass against published dependencies before the 0.44 version PR merges.
- In 0.44, deprecated APIs still work and authoring examples use their replacements. In the later
  removal release, old adapters remain only where required to read retained legacy data or resolve
  persistent URLs, outside the new authoring surface.

For this planning change, validate documentation links, numbering and formatting only.

## Source references

- [Capacity, retention and recovery requirements](0010-bound-client-storage-and-isolate-sync-failures.md)
- [Current storage types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage.ts)
- [Current file/context types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts)
- [Host file wiring](../../../packages/pstdio-api/src/features/extensions/command-environment/index.ts)
- [Record save contract](../../references/sdk/0004-storage.md)
- [Asset contract](../../guides/sdk/0002-assets.md)
- [File ownership and layouts](../../guides/extensions/0008-extension-storage.md)
- [Deprecation and removal decision](../../adrs/0047-semantic-versioning-for-the-extension-api.md)
