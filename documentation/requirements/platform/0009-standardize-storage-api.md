# PRD: Standardize extension storage

Status: Proposed. Created: 2026-10-17. This document plans the changes; it does not change the API.

Target releases: **0.44.0** adds the new APIs and deprecates the old ones. **0.45.0** moves every
maintained extension to the new APIs, converts stored data and removes everything deprecated in 0.44.
The [API simplification PRD](0011-simplify-extension-apis.md) uses the same release plan.

Extensions currently choose between deprecated structured storage calls, versioned records,
uploads addressed by file IDs, and several filesystem interfaces. Standardize file access,
migrate callers to records and assets, then remove the replaced APIs in one breaking release.

## Benefits and trade-offs

### What shrinks, and what does not

The [runnable comparison](../../references/sdk/0005-api-clarity-prototype.md) tests 15 author tasks.

| Purpose | Current families | Revised design |
| --- | --- | --- |
| Structured data | KV, collections, records | Records; `save` wraps a revision-guarded commit for one record. |
| Uploaded bytes | Mutable file IDs, collection attachments, assets | Assets plus an attachment helper over records and assets. |
| Paths | Five root accessors in several namespaces | Five named root accessors under `files`; the five root meanings remain. |

No whole-API reduction percentage is established; namespace count is not the acceptance target. A
helper adds a public method without adding a storage owner, which is acceptable when it removes
repeated correctness code. A guarded save falls from 54 to 32 function-body tokens; the attachment
helper needs 39 versus 142 for the manual recipe. These measure syntax, not comprehension.

### What becomes easier

- Ticket and report editors keep the revision they read and report a stale save with one rule.
- One set of relative-path methods reads templates, writes drafts and edits workspace source.
  Named accessors state the root at the call site.
- Attachments and published Artifacts revisions share one upload, resume and verified-read API.
  A published revision no longer needs its own permanent HTML file.

### Custom use cases we drop or move

| Existing use | Required change |
| --- | --- |
| Save a key with `set(key, value)` without keeping the revision from the editor's read. | Keep the read revision, save against it and handle a conflict. Blind replacement leaves the authoring API. |
| Let a collection generate IDs, keep ordering and attach files to items. | The extension defines stable domain IDs and ordering. The attachment helper handles metadata and retry identity. |
| Create and edit documents by file ID through `storage.files` or `ctx.files.createText`. | Store metadata and an asset reference in an owned record, or edit a file through an explicit root. New bytes create a new immutable version. Old file-ID URLs keep working (see [URLs](#urls)). |
| Open every published Artifacts revision as a permanent local HTML file. | Read its asset or explicitly export a file. Migrate direct-file consumers before removing redundant files. |

Small extensions write more code than a bare `get/set` pair: they keep revisions, handle save
outcomes and own their domain schema and ordering.

## Storage capacity

The asset store keeps completed versions with no automatic expiry
([assets guide](../../guides/sdk/0002-assets.md#read-and-cancel)). 0.44 ships records and assets with
that behavior: no eviction, no compaction and no enforced budgets. They stay off until the
[capacity and recovery PRD](0010-bound-client-storage-and-isolate-sync-failures.md) publishes
measured defaults. That PRD's release gates block the 0.45 data conversion and any change that
turns eviction, compaction or budgets on. Do not resolve capacity by silently deleting local
durability, conflicts, published URLs or restore material.

## Release plan

0.44 is not released yet. [Version Packages PR 1078](https://github.com/pufflyai/prompt-studio/pull/1078)
is open and lists `pstdio@0.44.0`. 0.44 already breaks the extension API: `EXTENSION_API_VERSION` is
0.1.6 at tag `pstdio@0.43.1` and 0.2.0 on `main`, after the allocated extension file move. The
KV and collection deprecations exist only on `main`, so stable 0.43.1 did not deprecate them.

In 0.44 (extension API 0.2.0), remove every API that stable 0.43.1 deprecated; ticket PS-805 tracks
this with host bug fixes. Add every new API in this PRD and mark the APIs it replaces `@deprecated`,
naming the replacement. Old APIs that 0.43.1 did not deprecate keep working. Add the
[save outcome](#save-outcomes) type changes now, while the release already breaks. All of this
merges before PR 1078 merges.

In 0.45 (extension API 0.3.0), core and repo-local extensions adopt the new APIs against the
published 0.44 SDK and [convert their data](#data-conversion). Core extensions type-check against
npm, and SDK and extension changes go in separate PRs. Then remove everything deprecated in 0.44.

Product versions come from the shared Changesets fixed group. The removal PR uses a `minor`
changeset, so the removal release is the next minor after 0.44, which is 0.45.0. Patch releases
between them are fine. Never pick or edit versions by hand. An API that is not deprecated in a
stable 0.44 is not removed in 0.45; it waits for the next breaking release.

The 0.45 order follows [step 6 of the API version checks](../../references/architecture/0024-extension-api-version-checks.md#changing-the-api)
and the [PR separation rule](../../guides/development/0004-pull-request-labels.md#sdk-and-extension-separation):

1. Release 0.44 so the new APIs exist in the published SDK.
2. For each maintained extension, open an extension-only PR against the published SDK. It stops using
   every API deprecated in 0.44 and converts its data. Because 0.45 only removes APIs, that build
   also runs on API 0.3.0, so the same PR widens `engines.pstdio` to `^0.2.0 || ^0.3.0`. PRs
   [1134](https://github.com/pufflyai/prompt-studio/pull/1134) and
   [1135](https://github.com/pufflyai/prompt-studio/pull/1135) used this order for API 0.2.
3. Merge the host and SDK removal PR last. It removes the deprecated APIs, sets
   `EXTENSION_API_VERSION` to 0.3.0, generates and checks the API report with `verify:extension-api-report`
   and adds the `minor` changeset. `verify:extension-api-version` passes only when every tracked
   manifest already accepts 0.3.0. Reviewers add `breaking-change` and `needs-migration`.
4. List each removal and its replacement in the 0.45 release notes.

The relay has no deployed users during alpha. Patch all extensions before enabling it. Do not add
relay schema translation for old extension builds. Planner's
[PR 1157](https://github.com/pufflyai/prompt-studio/pull/1157) remains subject to published-SDK checks.

## Proposed API

Keep `ctx.storage.records` for structured data and `ctx.storage.assets` for immutable bytes.
Expose named path handles under `ctx.files`. Keep `records.commit` for atomic multi-record edits.

```ts
const records = ctx.storage.records;
const task = await records.read(records.id("task-1"));
const value = task.value;
if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a task object.");
// Keep this ID with the draft. Retry the same captured task and value with it.
const operationId = crypto.randomUUID();
const outcome = await records.save(task, { ...value, title: "Launch Friday" }, { operationId });
if (outcome.status === "conflict") showConflict(outcome);

await ctx.files.shared("outputs").writeText("launch.html", html);
await ctx.files.local.writeText("draft.md", markdown);
await ctx.files.currentWorkspace.writeText("README.md", readme);
const template = await ctx.files.package.readText("templates/report.md");

await ctx.storage.attachments.add(task.recordId, file, { operationId: crypto.randomUUID() });
```

These contracts exist only in the isolated prototype. `save` replaces the whole record value, like
the prototype's [`saveRecord`](https://github.com/pufflyai/prompt-studio/blob/8b78846c1926eff6dd5a6aa4e873530f0ab5b26a/packages/sdk/prototypes/api-clarity/helpers.ts), which
commits `replace: value`. Callers spread the value they read to change one field. `save` forwards
the captured revision and never fetches a newer base. Persist the operation ID with durable drafts
when a retry must survive restart. An identical retry returns the retained outcome.

| Accessor | Resolves to | Behavior |
| --- | --- | --- |
| `files.shared(mountId)` | The extension's declared artifact mount | Journal-backed files in the default workspace; watched mounts reconcile direct edits and refresh views. |
| `files.local` | The extension's allocated directory | Environment-local files; keeps publisher isolation and ignore rules. |
| `files.currentWorkspace` | `ctx.workspaceId` only | Source edits through that workspace's provider. Keeps `syncDir`. |
| `files.defaultWorkspace` | The project's default workspace | Deliberate default-workspace source edits. |
| `files.package` | The installed extension package | Read-only. |

All handles use relative paths. Readable handles expose `exists`, `readText`, `readBytes`, `list`
and `listDirs`. Writable handles also expose `writeText`, `updateText`, `writeBytes` and `delete`.
Only `files.currentWorkspace` has `syncDir`, from today's
[`WorkspaceFilesMount`](../../../packages/pstdio-api-contracts/src/extension-kernel/types/context.ts).
`ctx.projectFiles` is a plain `ArtifactMount`, so `files.defaultWorkspace` does not add `syncDir`.
Keep the existing return values and the rule that `updateText` fails if the file is absent.

The package handle rejects writes in its types and at runtime. A handle binds to the resolved
extension, workbench, environment and workspace, checks readiness and permissions on each operation
and is never retargeted. Absolute roots and caller ownership claims are refused.

`files.currentWorkspace` fails when the context has no current workspace, or when that workspace is
gone or not ready. It never resolves the default workspace itself. This is new behavior on a new
member, so it ships in 0.44. Deprecated `ctx.workspaceFiles` keeps today's behavior until 0.45
removes it: a command without a workspace runs in the default workspace
([execute-project-extension-command.ts](../../../packages/pstdio-api/src/features/extensions/execute-project-extension-command.ts)),
and [`resolveLocalWorkspaceTarget`](../../../packages/pstdio-api/src/features/extensions/command-environment/workspace-target.ts)
falls back to `getDefault` when no workspace ID is given.

### Shared files today

`ctx.artifacts.mount(id)` uses the [shared artifact adapter](../../../packages/pstdio-api/src/services/shared-files/artifact-mount.ts).
It stores file metadata and asset references in the extension journal and reconciles materialized
files in the default workspace. The [relay owner](../../../packages/pstdio-api/src/services/relay/extension-owner.ts)
refreshes these mounts around production synchronization. `files.shared` must reuse these owners.
It does not make external writers obey revision guards.

### Attachment helper

`attachments.add(parentRecordId, file, { operationId })` composes records and assets, with no new
table, byte store or queue. It ships in 0.44 with `attachments.list(parentRecordId)` and
`attachments.delete(attachmentId, { operationId })`.

- Attachment metadata lives in its own namespace inside the extension's storage owner. It never
  appears in the extension's `records.list()`.
- `add` checks that the parent record exists and is not deleted, and rejects otherwise.
- A new upload's attachment ID is derived from its operation ID. Converted blobs and collection
  attachments keep their existing IDs.
- An identical retry returns the original result. The same operation ID with a changed file, name
  or parent returns `operation_payload_changed`. An operation ID already used by a different
  operation, such as a record commit, returns `operation_id_in_use`.
- Display and download go through authorized URLs (see [URLs](#urls)). Ordering stays with the
  extension's own records.

### Save outcomes

Add two members to `StorageSaveOutcome` in 0.44. Adding a union member can break exhaustive
callers, so it lands while 0.44 already breaks.

- `expired-revision`: the captured revision's base is gone. The draft stays; the caller must decide.
  Nothing returns it until compaction is enabled.
- A capacity outcome that names the space needed. Nothing returns it until budgets are enforced.

Enforcing budgets makes calls that succeed today fail, which is breaking. Turn it on only in a
breaking release after the [0010 gates](0010-bound-client-storage-and-isolate-sync-failures.md#release-gates) pass.

### Browser file access

Today `client.artifacts.list(mount, prefix)` filters by prefix and returns `{ path, size, mediaType }`
([webview-client.ts](../../../packages/sdk/src/extensions/webview-client.ts)). `client.files.shared(mount)`
replaces `client.artifacts`, keeps `readText` and `imageUrl`, and its `list(pattern)` uses the glob
rules and `{ path, size?, updatedAt? }` shape of `ArtifactMount.list`. The render context's
`files.upload`, `list` and `delete` take a `WebviewFileScope` and return blob refs
([define-extension-view.ts](../../../packages/sdk/src/extensions/define-extension-view.ts)). They map
to a browser attachment client with the same rules as `attachments`. `files.pick` stays.

## Map existing callers

| Existing API | Replacement |
| --- | --- |
| `storage.get/set/delete` | `storage.records.read/save` or `commit` with the observed revision. |
| `storage.collection(...)` | Domain records converted by the owning extension. |
| `storage.records`, `storage.assets` | Keep. |
| `storage.files` and collection attachments | `storage.attachments`. |
| `ctx.files` methods taking file IDs | Records and assets, after resolving the file's owner. |
| `ctx.artifacts.mount(id)` | `ctx.files.shared(id)`. |
| `ctx.extensionFiles` | `ctx.files.local`. |
| `ctx.workspaceFiles` | `ctx.files.currentWorkspace`. |
| `ctx.projectFiles` | `ctx.files.defaultWorkspace`. |
| `ctx.packageFiles` | `ctx.files.package`. |
| `client.artifacts.list/readText/imageUrl` | `client.files.shared(mount)`. |
| Render context `files.upload/list/delete` | Browser attachment client. |
| `HarnessContext.state` | Keep. See below. |

[`HarnessStateApi`](../../../packages/pstdio-api-contracts/src/extension-kernel/types/harness.ts) writes
one JSON file per extension in the host state folder
([harness-state.ts](../../../packages/pstdio-api/src/features/harnesses/harness-state.ts)). Its callers
store process state: Codex plan approvals ([plan-approval.ts](../../../extensions/harness-codex/src/plan-approval.ts)),
the local OpenCode server URL ([opencode-server.ts](../../../extensions/harness-open-code/src/opencode-server.ts))
and turn cursors ([turn-cursor.ts](../../../extensions/remote-workspaces/turn-cursor.ts)). Records
replicate; process state stays with its environment. So it stays a harness API and is not deprecated.

Keep `storage.scope`, `migrate` and `readLegacy`.

## Data and ownership requirements

- Old and new names use the same storage owner, root rules and safe-path checks, and never create
  another writable copy. The same owner does not mean the same fallback (see `files.currentWorkspace`).
- Keep mount declarations, access grants, file-change events, view refresh, revisions, tombstones,
  conflicts and restore recovery. A local save must not report relay acceptance.
- Carry the editor's read revision through save commands. Return conflicts before starting external
  work. Retry identical storage requests; never replay commands.

### Data conversion

On `main`, KV and collection rows already live in records. The host imports old rows into the
owner's journal on first access and deletes them in the same transaction
([legacy-import.ts](../../../packages/pstdio-db/src/services/extension-storage/legacy-import.ts)).

- KV needs no data conversion. A key's record ID equals `records.id(key)` in the same scope, and the
  value is unchanged. Callers switch to `records.read` and `save`.
- Collection items are records under a separate collection namespace, with value
  `{ value, sortOrder }`. `records.list()` does not show them. Each owning extension converts them to
  domain records in a `storage.migrate` step. Keep resource IDs and ordering, and keep the meaning of
  `createIfAbsent` and `deleteIfValue` without claiming a distributed lock.
- Blob and file-ID data converts to assets plus attachment records. Keep IDs, names, media types and
  parent links. Resolve old project-wide file ownership from stored references; never give an
  ambiguous file to whichever extension reads it first.
- A 0.45 extension converts on a 0.45 host, where the collection and blob methods are gone. So 0.44
  adds a migration reader for collection records and blob metadata, reachable inside
  `storage.migrate`, and keeps it through 0.45. Core extensions use it from the published 0.44 SDK.
- Planner and Reports drafts move to `files.local` with a one-time move in their 0.45 conversion.
  See [Planner and Reports drafts](#planner-and-reports-drafts).
- While an extension converts in a project, the host rejects that extension's commands, hooks and
  schedules in that project with `storage_converting`. Callers retry after conversion. Use stable
  migration operation IDs, resume interrupted conversion and verify it before admitting commands.
  Avoid ongoing dual writes.

### URLs

Today a blob's `url` and `urlFor(id)` address a file ID, not content
([blobs.ts](../../../packages/pstdio-api/src/features/extensions/command-environment/blobs.ts)), and
`ctx.files.writeText(fileId)` replaces bytes in place
([files.ts](../../../packages/pstdio-api/src/features/extensions/command-environment/files.ts)).
URLs issued before conversion keep resolving through 0.45 and keep serving the current bytes for that
ID. New asset URLs name the owner and content digest, so one URL always returns the same bytes.
Tests: an old URL returns the same bytes before and after conversion; replacing an attachment
creates a new URL while the old URL still returns the old bytes.

### Planner and Reports drafts

Planner writes ticket checkouts to `.pstdio/extension-storage/pstdio.pstdio-planner/tickets/` through
`ctx.projectFiles` ([draft-storage.ts](../../../extensions/pstdio-planner/src/data/draft-storage.ts)).
Reports does the same under `pstdio.pstdio-reports/reports/`
([draft-storage.ts](../../../extensions/pstdio-reports/src/data/draft-storage.ts)). Both skip the
`.publishers/<publisher>/` child. A checkout and a draft are the same files: `pst tickets pull`
writes them and `save` reads them back. They are extension working data, so they move to
`files.local`. `files.local` also resolves in the default project folder, and commands return
absolute paths, so agents in other workspaces still find them. Planner's `.pstdio/.gitignore` edit is
project source and stays on `files.defaultWorkspace`.

## Implementation order

1. 0.44: add the file-root types, `records.save`, the attachment helper, browser handles, the
   migration reader and the new outcome members on the existing host adapters, with SDK testing
   support. Leave the old `ctx.files` file-ID methods unchanged. Mark the replaced APIs deprecated,
   publish the upgrade guide and update the API report. Inventory direct calls, destructured aliases,
   view bridges, CLI and SDK consumers, fixtures and examples. Merge before PR 1078.
2. 0.45, Notes and Artifacts: move Notes to `files.shared` and check native edit conflicts and
   refreshes. Move Artifacts' source reads to explicit workspace roots and store published revisions
   as metadata plus asset references, keeping URLs, revision IDs, labels and ordering. Remove
   redundant revision files only after verifying their assets and direct-file consumers.
3. 0.45, Planner and Reports: convert collections, templates and attachments; move drafts to
   `files.local`. Keep saved views, IDs, URLs, grouped saves and checks before agent work.
4. 0.45, harnesses: keep provisioning and `syncDir` for `.agents/skills` and `.claude/skills`. A
   provisioning event still writes to its actual target workspace.
5. 0.45, Skills, Extension Lab and repo-local extensions: migrate storage calls and examples.
6. 0.45, merged last: remove the old context properties, KV, collection, blob and file-ID methods
   and `client.artifacts`. Keep the migration reader and old URL routes.

## Documentation to update

These teach `ctx.extensionFiles` or other replaced APIs. Update them in 0.45, before the old names
are removed:

- The "Extension storage" section of [CLAUDE.md](../../../CLAUDE.md).
- [Extension file storage](../../guides/extensions/0008-extension-storage.md) and
  [allocated extension files](../../guides/extensions/0009-allocated-extension-files.md).
- The [save workflow](../../guides/sdk/0003-storage.md) and the
  [webview and storage reference](../../references/extensions/0005-webview-and-storage-api.md).
- The create-extension skill's
  [extension API reference](../../../extensions/pstdio-skills/skills/create-pstdio-extension/references/extension-api.md),
  generated examples, and the Planner and Reports skills that print checkout paths.

## Dependencies

The [relay owner](../../../packages/pstdio-api/src/services/relay/extension-owner.ts) and
[shared-file adapter](../../../packages/pstdio-api/src/services/shared-files/artifact-mount.ts) already
exist. Connect `files.shared` to those owners; do not build a second relay client.

## Completion checks

See the [storage acceptance checks](../../references/extensions/0026-storage-acceptance.md).

## Source references

- [Storage types](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage.ts),
  [host file wiring](../../../packages/pstdio-api/src/features/extensions/command-environment/index.ts)
  and [host KV and collection wiring](../../../packages/pstdio-api/src/features/extensions/command-environment/storage.ts)
- [Record save contract](../../references/sdk/0004-storage.md), [API versioning](../../references/extensions/0014-api-versioning.md)
  and [ADR 0047](../../adrs/0047-semantic-versioning-for-the-extension-api.md)
