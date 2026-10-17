# PRD: Bound client storage and isolate sync failures

Status: Proposed. Created: 2026-10-17. Part of the
[storage standardization PRD](0009-standardize-storage-api.md). Platform safety features ship in 0.44;
0.45 updates all extensions, and 0.46 removes old APIs and deprecated paths in a breaking release.
This PRD records design flaws and requirements. It does not implement their fixes or select unmeasured limits.

## Problem and release requirement

The current asset store retains completed versions indefinitely. Synchronization fetches assets
referenced by retained operations before applying a snapshot or submitting local changes.
Disk use can grow with all historical content, and a missing old file can stop current work syncing.
Reducing the number of public storage APIs does not fix either problem.

The 0.44 platform release requires bounded client storage, recoverable cleanup and failure isolation.
Treat these as prerequisites for expanding records/assets adoption. Documenting them does not clear
the release requirement. Do not report this design as ready while limits and recovery remain undefined.

The relay has no deployed users during alpha. All extensions are patched before relay rollout.
Supporting old extension builds and translating their queued schema writes over relay are outside scope.
Local data conversion, open editor drafts and offline work made with the supported contract remain protected.

## What is versioned

| Data | Current or planned behavior | Required boundary |
| --- | --- | --- |
| Structured records | Current state, operations, revisions, deletion markers and conflict alternatives are retained. | Keep enough information for safe saves and recovery. Protocol history does not automatically provide a user-facing history browser. |
| Immutable assets | Each distinct byte content is a complete version. Completed local versions have no automatic expiry. | Immutability prevents replacement of a version; it must not imply that every client keeps every version forever. |
| Shared files | The relay design combines a materialized editable file with journal operations and referenced asset bytes. Native integration remains under review. | Retain required recovery bytes; materialize files only where the workflow needs them. |
| Local drafts and caches | Ordinary files owned by an environment. | Do not automatically journal every draft or cache file. Classify disposable caches separately from unsaved user work. |
| Workspace source | Ordinary files accessed through the selected workspace provider. | Preserve provider behavior. Git history depends on Git operations; file writes do not create commits. |
| Package files | Read-only files from an installed extension version. | Package retention and offline availability are separate from editable document history. |

Sessions, settings and other domain APIs keep their existing owners. This proposal does not version
every database table or every file an extension can access.

## Client disk costs

A native or hosted runtime stores its own database and assets. A second replicating runtime adds
another local store. A browser connected to a runtime has UI state and browser caching; it is not
automatically another durable copy of the runtime's entire journal and asset history.

Account for all of these components when measuring a runtime:

- Current record state and indexes.
- Accepted and pending operations, receipts, revision information, deletion markers and conflicts.
- Complete immutable asset versions, including historical and unresolved versions.
- Materialized editable files, exported files and local source drafts.
- Partial uploads, interrupted downloads and staging files.
- Installed packages, caches and migration backups. Measure temporary migration peaks too.

For example, 100 distinct versions of a 10 MB asset consume about **1 GB of asset bytes** before
database overhead, editable copies or temporary transfers. A one-byte change produces another full
asset version; the current store does not encode binary differences. Uploading identical content
reuses the completed version within the same workbench/extension owner. A separate transfer can
still stage bytes before completion. Do not assume deduplication across owners, machines or backups.

Deleting a record does not reclaim its completed assets. Current project cleanup removes mutable
blobs but preserves immutable versions. An interrupted transfer keeps partial bytes for resumption.
These behaviors preserve recovery but currently provide no bound on client disk use.

The current sync implementation enumerates assets from snapshot receipts as well as current records.
A new or returning environment can therefore fetch old versions it has not opened. Verification
also reads complete local assets. Measure disk reads, network bytes, initial sync time and reconnect
cost as history grows; current file size alone does not predict those costs.

## Failure cases

| Failure | Current consequence or design risk | Required behavior |
| --- | --- | --- |
| Historical versions or partial transfers fill the disk. | Asset staging, database writes or materialization fail. Even a small current workbench can have a large history. | Enforce admission and cache limits, preserve durable work and report space needed before starting avoidable large writes. |
| A historical asset is missing, corrupt or unavailable remotely. | Snapshot asset download throws before snapshot application and before pending local operations are submitted. The extension's sync attempt stops. | Fail that history request explicitly. Current metadata and unrelated operations must continue without requiring all historical bytes. |
| Current file bytes are unavailable. | A reference exists but the file cannot open or be verified. | Show that the file is unavailable and support retry. Do not report it ready, discard local edits or stall unrelated records. |
| Upload completes but record commit fails. | Completed bytes remain without a successful content reference. There is no automatic reclamation. | Track safe reclamation of abandoned completed uploads, including crashes and concurrent commits. |
| Cleanup evicts an old asset before an identical save retry. | Current commit code checks local bytes before looking up the known operation, so the retry can fail despite a retained outcome. | Return the retained outcome for an identical request without requiring evicted bytes. Reject changed payloads using the same ID. |
| Compaction removes the base of an open editor. | Revision tokens name journal operations; saving after their removal can throw `Unknown record revision`, even when no pending save exists. | Preserve a usable captured base or define an explicit expired-revision result that preserves the draft and requires a decision. Never substitute a later read silently. |
| Connection drops during transfer or after relay commit. | Partial bytes remain, or the client cannot know whether publication succeeded. | Resume with the original operation ID and identical request. Inspect its outcome. Do not rerun a command that starts external work. |
| Local save succeeds while the relay is unavailable. | Another environment cannot see it. Losing the only local copy before replication can lose that work. | Distinguish local durability from relay acceptance. Preserve the queue across restart and show pending work. |
| Concurrent edits or stale conflict resolution collide. | Complete alternatives and their bytes remain; dependent work may wait. | Keep the draft and exact revision, expose the conflict and let unrelated work progress. Never silently choose a winner to save space. |
| Credentials expire or peers support incompatible protocols. | Remote synchronization cannot proceed. | Keep local work readable and queued. Report the required sign-in or update; preserve original payloads for retry. |
| Cleanup races a commit, restore or offline environment. | Required bytes, revision ancestry or receipts could be deleted before recovery uses them. | Prove a durable recovery copy or retained coverage before reclamation. Never infer safety only from age or absence in current records. |
| Migration or root resolution chooses the wrong location or owner. | Old links can break, data can be hidden, or files can be written into the wrong workspace. | Resolve ownership explicitly, verify conversion, resume interrupted migration and reject unavailable targets without fallback. |

## Required changes

### 1. Define storage classes and budgets

Separate required local data from downloadable history and disposable caches. Pending operations,
unsent bytes, unsaved drafts and unresolved work must remain protected. A user may explicitly pin
content for offline use. Published history can remain retained remotely without being pinned on
every client; evict a local copy only when another verified durable copy can serve it again.
That guarantee must include asset catalog metadata, backup/restore coverage and permission to retrieve
the bytes. A prior successful upload alone does not prove that the copy remains recoverable.

Specify actual byte limits for local history/cache and staging, accounting for database and file
usage. Define the total admission policy, free-space reserve, concurrent transfer limits and behavior
when protected data alone exceeds the budget. A cache budget cannot bound indefinite offline writes;
stop accepting additional writes safely when capacity is exhausted and preserve already saved work.
Changing limits must not turn into silent deletion of protected data.

Set and justify defaults before implementation is called ready. The existing PS-735 workload of
10,000 records and 5 GiB remains unchanged; it is a workload, not an established client disk limit.
Record measured steady-state use and peak space during download, migration, compaction and recovery.

### 2. Separate synchronization from historical downloads

Do not download every asset referenced by every receipt before submitting unrelated local work or
updating current metadata. Fetch historical content when requested or explicitly pinned. Allow
current content to have a clear unavailable/not-downloaded state until its local bytes verify.
State which records, packages and assets are required before an environment is ready offline.

Preserve whole-group application and checkpoint atomicity. Relay publication still requires verified
complete bytes; a client with metadata must not claim it already has them. A failed historical fetch
must not stop metadata sync, unrelated uploads or record-only saves. A failed current asset may
block its dependent operation, but must not block an unrelated group in the same extension owner.

### 3. Reclaim space without breaking recovery

Define separate rules for deleting a local cache copy and permanently deleting retained content.
Protect current references, pending work, conflicts, pinned offline files, promised published
revision URLs and recovery/backup references. For local-only workbenches, the local store may be
the only durable copy; remote eviction rules cannot apply until replication is verified.

Implement recoverable cleanup for abandoned staging files and unreferenced completed uploads.
Account for an upload that has completed while its commit is still in flight. Define how active
transfers are distinguished from abandoned transfers across restart. Make cleanup resumable and
safe against concurrent writes, and report how much space is actually reclaimable.

Compact journals and snapshots only with verified coverage that preserves operation identity,
outcomes, revision lineage, deletion markers, dependency ancestry and restore recovery. The current
protocol requires that material to survive. Changing retention requires an explicit contract design
and evidence for patched environments returning with durable work saved before compaction or restore.
A TTL alone is insufficient.

Captured revisions held by open editors must also survive the chosen compaction policy. Current read
tokens include the contributing operation IDs, and a save reconstructs its base from journal entries.
Define the retained base or explicit expiry contract before removing those entries. Bound revision-token
size and metadata growth too. Protecting only already-queued writes misses an editor's first save.

An identical retry of a known operation returns its retained outcome before requiring evicted historical
bytes. Preserve payload fingerprint checks and define how a genuinely new operation reacquires bytes.

Define project deletion, retained backups and published-history deletion separately. State whether
each action frees local space, removes remote content or affects an existing persistent link.
Do not promise that deleting a record immediately frees all related bytes.

### 4. Make failures actionable

Expose local disk usage by category, pending synchronization, download availability and cleanup
results. When a save cannot proceed, explain whether space, bytes, permission, protocol support or
a conflict is blocking it. Preserve the draft and provide an action that can resolve the condition.
Keep these outcomes available through public APIs for both UI and agent callers.

## Acceptance evidence for 0.44 platform features and 0.45 adoption

- Publish exact limits, retention rules, protected-data rules and the offline-ready definition.
- Hold current record count and current asset size fixed while increasing historical operations.
  Measure journals, snapshots, receipts, indexes, revision tokens, cache and staging separately, and
  prove their configured local bounds. Asset eviction alone does not prove bounded metadata use.
- Receive remote metadata when its owner lacks capacity. Preserve saved work and let other owners progress.
- Measure 100 distinct 10 MB versions and repeated uploads of identical content. Show asset bytes,
  database growth, editable copies and temporary peaks separately. No historical bytes download
  merely because a current metadata update arrives, except content explicitly required by policy.
- Exceed the cache budget through repeated history reads. Demonstrate bounded cache use while
  preserving pending work, conflicts, offline pins and promised remote history.
- Exhaust available space during staging and during a local save. Preserve previously durable work,
  avoid a partially published group and report a recoverable capacity error.
- Remove or corrupt an old asset and deny its download. Current metadata and an unrelated local
  save in the same extension owner still synchronize. Opening that old revision reports its failure.
- Withhold current bytes. Opening the file reports unavailable; unrelated groups still progress.
  A mixed record/asset operation does not falsely publish or report complete local bytes.
- Interrupt upload, record commit and cleanup at each durable boundary. Restart and resume without
  duplicate publication, premature deletion or permanent accumulation of safely reclaimable files.
- Read a record, compact its history, then save with the original revision. Cover JSON, text, lists
  and assets. Preserve the draft and base guarantees, including a defined expired-revision outcome.
- Commit an asset, replace it, evict its historical bytes, then retry the original identical commit.
  Return its retained outcome; a changed request with the same operation ID still fails.
- Reconnect an offline environment using the supported contract after compaction and relay restore. Preserve pending
  and newer accepted work, recover required ancestry and retain conflicts for explicit resolution.
- Exercise local-only workbenches, expired credentials, unsupported peers and migrations that exceed
  the available budget. Preserve local content and show the required next action.
- Record capacity and reconnect results for the unchanged 10,000-record/5 GiB workload. Do not
  change existing performance budgets, reduce the workload or skip a platform to pass a check.

For this documentation-only change, verify source claims, local links, numbering and formatting.
Runtime implementation and the acceptance evidence above remain outstanding.

## Evidence and related contracts

- [Completed asset retention and project cleanup](../../guides/sdk/0002-assets.md#read-and-cancel)
- [Complete-version storage and deduplication](../../../packages/pstdio-storage/src/services/asset-bytes.ts)
- [Asset paths scoped by workbench and extension](../../../packages/pstdio-storage/src/storage/asset-byte-paths.ts)
- [Snapshot assets include retained receipt references](../../../packages/pstdio-sync/src/asset-transfer.ts)
- [Assets download before snapshot application and local submission](../../../packages/pstdio-sync/src/synchronize.ts)
- [Journal retention and restore rules](../../references/architecture/0026-synchronization-contracts.md#replay-snapshots-retention-and-restore)
- [Local save and synchronization outcomes](../../references/sdk/0004-storage.md#edits-and-outcomes)
- [Read revisions name journal operations](../../../packages/pstdio-sync/src/projection.ts)
- [Saving reconstructs the captured revision](../../../packages/pstdio-sync/src/authoring.ts)
- [Asset verification currently precedes retry lookup](../../../packages/pstdio-sync/src/storage.ts)
- [Connection-owned browser collections](../../../packages/pstdio-dashboard/src/lib/sync/collections.ts)
- [PS-735 workload and production work still required](0007-synchronization-contracts.md#handoff-and-remaining-work)
