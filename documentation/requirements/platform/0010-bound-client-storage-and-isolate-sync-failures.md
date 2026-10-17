# PRD: Bound client storage and isolate sync failures

Status: Proposed. Created: 2026-10-17. Part of the
[storage standardization PRD](0009-standardize-storage-api.md). This PRD records design flaws,
requirements and release gates. It does not implement their fixes or select unmeasured limits.

## Problem and release requirement

The asset store keeps completed versions with no automatic expiry. The sync code in `pstdio-sync`
fetches assets referenced by retained operations before applying a snapshot or submitting local
changes. Disk use can grow with all historical content. Once sync runs, a missing old file can stop
current work syncing. Reducing the number of public storage APIs does not fix either problem.

Records and assets already ship in 0.44 with today's retention: no eviction, no compaction and no
enforced budgets ([assets guide](../../guides/sdk/0002-assets.md#read-and-cancel)). They stay off in
0.44. The measured defaults and the [release gates](#release-gates) below block two later steps: the
0.45 data conversion in the storage PRD, and any change that turns on eviction, compaction or
budget enforcement. Do not report this design as ready while limits and recovery remain undefined.

The relay has no deployed users during alpha. All extensions are patched before relay rollout.
Supporting old extension builds and translating their queued writes over relay are out of scope.
Local data conversion, open editor drafts and offline work made with the supported contract stay protected.

## What is versioned

| Data | Current or planned behavior | Required boundary |
| --- | --- | --- |
| Structured records | Current state, operations, revisions, deletion markers and conflict alternatives are retained. | Keep enough for safe saves and recovery. Protocol history is not a user-facing history browser. |
| Immutable assets | Each distinct byte content is a complete version. Completed local versions have no automatic expiry. | Immutability prevents replacing a version; it must not mean every client keeps every version forever. |
| Shared files | Today: plain files behind an artifact mount, with no journal. Planned: relay adapters add journal operations and referenced asset bytes. | Retain required recovery bytes; materialize files only where the workflow needs them. |
| Local drafts and caches | Ordinary files owned by an environment. | Do not journal every draft or cache file. Classify disposable caches separately from unsaved user work. |
| Workspace source | Ordinary files accessed through the selected workspace provider. | Keep provider behavior. File writes do not create Git commits. |
| Package files | Read-only files from an installed extension version. | Package retention is separate from editable document history. |

Sessions, settings and other domain APIs keep their existing owners. This PRD does not cover them,
and it does not version every database table or every file an extension can access.

## Client disk costs

A native or hosted runtime stores its own database and assets. A second replicating runtime adds
another local store. A browser connected to a runtime has UI state and browser caching; it is not
another durable copy of the runtime's journal and asset history.

Account for all of these when measuring a runtime:

- Current record state and indexes.
- Accepted and pending operations, receipts, revision information, deletion markers and conflicts.
- Complete immutable asset versions, including historical and unresolved versions.
- Materialized editable files, exported files and local source drafts.
- Partial uploads, interrupted downloads and staging files.
- Installed packages, caches and migration backups, including temporary migration peaks.

For example, 100 distinct versions of a 10 MB asset use about **1 GB of asset bytes** before
database overhead, editable copies or temporary transfers. A one-byte change produces another full
version; the store does not encode binary differences. Identical content reuses the completed
version within the same workbench and extension owner. A separate transfer can still stage bytes
before completion. Do not assume deduplication across owners, machines or backups.

Deleting a record does not reclaim its completed assets. Project cleanup removes mutable blobs but
keeps immutable versions. An interrupted transfer keeps partial bytes for resumption. These
behaviors keep recovery safe but give no bound on client disk use.

The sync code enumerates assets from snapshot receipts as well as current records, so a new or
returning environment would fetch old versions it has not opened. Verification also reads complete
local assets. Measure disk reads, network bytes, initial sync time and reconnect cost as history
grows; current file size alone does not predict them.

## Failure cases

Production does not run sync yet. `synchronize()` in
[synchronize.ts](../../../packages/pstdio-sync/src/synchronize.ts) is called only by `pstdio-db`
integration and conformance tests. Shared files have no journal. Cleanup, eviction and compaction do
not exist. The middle column says what happens today, or what the tested sync code will do once
it runs in production.

| Failure | Today, or once sync runs | Required behavior |
| --- | --- | --- |
| Historical versions or partial transfers fill the disk. | Today: asset staging, database writes or file writes fail. A small current workbench can have a large history. | Enforce admission and cache limits, keep durable work and report the space needed before starting avoidable large writes. |
| A historical asset is missing, corrupt or unavailable remotely. | Once sync runs: snapshot asset download throws before the snapshot applies and before pending local operations are sent. That sync attempt stops. | Fail that history request explicitly. Current metadata and unrelated operations continue without all historical bytes. |
| Current file bytes are unavailable. | Today: a local reference whose bytes are missing cannot open or verify. Once sync runs, this also covers bytes not yet downloaded. | Show the file as unavailable and support retry. Never report it ready, discard local edits or stall unrelated records. |
| Upload completes but record commit fails. | Today: completed bytes stay without a reference. Nothing reclaims them. | Track safe reclamation of abandoned completed uploads, including crashes and concurrent commits. |
| Cleanup evicts an old asset before an identical save retry. | Design risk: no eviction exists. Commit code checks local bytes before looking up the known operation, so a retry would fail despite a retained outcome. | Return the retained outcome for an identical request without the evicted bytes. Reject changed payloads that reuse the ID. |
| Compaction removes the base of an open editor. | Design risk: no compaction exists. Revision tokens name journal operations; saving after their removal would throw `Unknown record revision`. | Keep a usable captured base, or return `expired-revision`, keep the draft and require a decision. Never silently substitute a later read. |
| Connection drops during transfer or after relay commit. | Today: a local transfer keeps partial bytes. Once sync runs, the client may not know whether publication succeeded. | Resume with the original operation ID and identical request. Inspect its outcome. Never rerun a command that starts external work. |
| Local save succeeds while the relay is unavailable. | Once sync runs: other environments cannot see it. Losing the only local copy before replication loses that work. | Distinguish local durability from relay acceptance. Keep the queue across restart and show pending work. |
| Concurrent edits or stale conflict resolution collide. | Today: complete alternatives and their bytes are kept; dependent work may wait. | Keep the draft and exact revision, expose the conflict and let unrelated work continue. Never pick a winner to save space. |
| Credentials expire or peers support incompatible protocols. | Once sync runs: remote synchronization cannot proceed. | Keep local work readable and queued. Report the needed sign-in or update; keep original payloads for retry. |
| Cleanup races a commit, restore or offline environment. | Design risk: no cleanup exists. A naive one could delete bytes, revision ancestry or receipts before recovery uses them. | Prove a durable recovery copy or retained coverage before reclaiming. Never infer safety from age or absence in current records. |
| Migration or root resolution picks the wrong location or owner. | Today: old links can break, data can be hidden, or files can be written to the wrong workspace. | Resolve ownership explicitly, verify conversion, resume interrupted migration and reject unavailable targets without fallback. |

## Required changes

### 1. Define storage classes and budgets

Separate required local data from downloadable history and disposable caches. Pending operations,
unsent bytes, unsaved drafts and unresolved work stay protected. A user may pin content for offline
use. Published history can stay retained remotely without being pinned on every client. Evict a
local copy only when another verified durable copy can serve it again. That includes asset catalog
metadata, backup and restore coverage and permission to fetch the bytes. A past upload alone does
not prove that a copy is still recoverable.

Specify byte limits for local history, cache and staging, counting database and file usage. Define
the admission policy, free-space reserve, concurrent transfer limits and behavior when protected
data alone exceeds the budget. A cache budget cannot bound offline writes; stop accepting new
writes safely when space runs out and keep saved work. Changing limits must never silently delete
protected data.

Set and justify defaults before calling the implementation ready. The PS-735 workload of 10,000
records and 5 GiB stays unchanged; it is a workload, not a client disk limit. Record steady-state
use and peak space during download, migration, compaction and recovery.

### 2. Separate synchronization from historical downloads

Do not download every asset referenced by every receipt before sending unrelated local work or
updating current metadata. Fetch historical content when requested or pinned. Let current content
have a clear not-downloaded state until its local bytes verify. State which records, packages and
assets an environment needs before it is ready offline.

Keep whole-group application and checkpoint atomicity. Relay publication still needs verified
complete bytes; a client with only metadata must not claim to have them. A failed historical fetch
must not stop metadata sync, unrelated uploads or record-only saves. A failed current asset may block
its dependent operation, but not an unrelated group in the same extension owner.

### 3. Reclaim space without breaking recovery

Define separate rules for deleting a local cache copy and permanently deleting retained content.
Protect current references, pending work, conflicts, pinned offline files, published revision URLs
and recovery or backup references. In a local-only workbench the local store may be the only
durable copy; remote eviction rules cannot apply until replication is verified.

Add recoverable cleanup for abandoned staging files and unreferenced completed uploads. Account for
an upload that has completed while its commit is still in flight. Tell active from abandoned
transfers across restart. Make cleanup resumable and safe against concurrent writes, and report how
much space it can actually reclaim.

Compact journals and snapshots only with verified coverage that keeps operation identity, outcomes,
revision lineage, deletion markers, dependency ancestry and restore recovery. A TTL alone is not
enough. Captured revisions held by open editors must survive the chosen policy too. Read tokens
include contributing operation IDs, and a save rebuilds its base from journal entries. Define the
retained base or the `expired-revision` contract before removing those entries. Bound revision-token
size and metadata growth. Protecting only queued writes misses an editor's first save.

An identical retry of a known operation returns its retained outcome before needing evicted bytes.
Keep payload fingerprint checks and define how a new operation fetches bytes again.

Define project deletion, retained backups and published-history deletion separately. State whether
each frees local space, removes remote content or affects an existing link. Do not promise that
deleting a record frees all related bytes right away.

### 4. Amend the sync contracts first

Compaction and eviction conflict with two existing contracts:

- The [synchronization contract reference](../../references/architecture/0026-synchronization-contracts.md#replay-snapshots-retention-and-restore)
  says not to compact receipts until a coverage design is proved, keeps completed versions without
  expiry, and has restore validate the immutable bytes that retained history needs.
- The [synchronization contracts PRD](0007-synchronization-contracts.md#handoff-and-remaining-work)
  gives retention to later relay work and authorizes no automatic history expiration.

Before any compaction or eviction is turned on, amend both documents or record the change in an ADR.
Link that change from the PR that turns the feature on.

### 5. Make failures actionable

Expose local disk usage by category, pending sync, download availability and cleanup results. When
a save cannot proceed, say whether space, bytes, permission, protocol support or a conflict blocks
it. Keep the draft and offer an action that can resolve it. Return these outcomes through public
APIs for both UI and agent callers. The storage PRD adds the
[outcome members](0009-standardize-storage-api.md#save-outcomes) in 0.44.

## Limits of the authoring prototype

The [API experiment](../../references/sdk/0005-api-clarity-prototype.md) runs guarded saves and
completed attachment retries against the real in-memory record engine. It proves neither bounded
storage nor recovery after compaction, eviction, restart or relay failure. Its attachment retry
still hashes the supplied file and reads retained metadata even when it avoids staging again.
Production helpers must return the same capacity, availability and durability outcomes as the raw
primitives. They must not hide pending replication, unavailable bytes or protected data that
exceeds a budget.

## Release gates

### Gate 1: before the 0.45 data conversion merges

The conversion moves blob and file-ID bytes into assets and collection records into domain records.
It cannot merge until all of these hold:

- This PRD lists the default limits, free-space reserve and protected-data rules, with the
  measurement run they come from.
- A test converts a fixture project, records peak disk use during conversion, and shows that
  conversion refuses to start, with the space needed, when free space is below that peak plus the
  reserve.
- A test interrupts conversion at each durable boundary, restarts, and finishes without duplicate
  records or assets and without deleting source data before verification.
- A test exhausts space during staging and during a local save. Saved work survives, no group is
  half-applied and the caller gets the capacity outcome.
- A test stores 100 distinct 10 MB versions and repeated identical uploads, and reports asset bytes,
  database growth, editable copies and temporary peaks separately.
- After conversion, eviction and compaction stay off: completed asset versions and journal entries
  remain, and the [assets guide](../../guides/sdk/0002-assets.md#read-and-cancel) still matches.

### Gate 2: before eviction, compaction or budget enforcement turns on

Required changes 1 to 5 are done, the sync contracts are amended (change 4), and this evidence passes:

- Hold current record count and current asset size fixed while historical operations grow. Measure
  journals, snapshots, receipts, indexes, revision tokens, cache and staging separately, and prove
  their limits. Asset eviction alone does not prove bounded metadata use.
- Receive remote metadata when its owner lacks space. Keep saved work and let other owners progress.
- No historical bytes download merely because a current metadata update arrives, except content
  required by policy.
- Exceed the cache budget through repeated history reads. Cache use stays bounded while pending
  work, conflicts, offline pins and remote history are kept.
- Remove or corrupt an old asset and deny its download. Current metadata and an unrelated local save
  in the same owner still sync. Opening that old revision reports its failure.
- Withhold current bytes. Opening the file reports unavailable; unrelated groups still progress. A
  mixed record and asset operation does not falsely publish or report complete local bytes.
- Interrupt upload, record commit and cleanup at each durable boundary. Restart and resume without
  duplicate publication, early deletion or permanent build-up of reclaimable files.
- Read a record, compact its history, then save with the original revision. Cover JSON, text, lists
  and assets. Keep the draft and base guarantees, or return `expired-revision`.
- Commit an asset, replace it, evict its historical bytes, then retry the original identical commit.
  Return its retained outcome; a changed request with the same operation ID still fails.
- Reconnect an offline environment after compaction and relay restore. Keep pending and newer
  accepted work, recover required ancestry and keep conflicts for explicit resolution.
- Exercise local-only workbenches, expired credentials, unsupported peers and migrations that
  exceed the budget. Keep local content and show the next action.
- Record capacity and reconnect results for the unchanged 10,000-record, 5 GiB workload. Do not
  change performance budgets, shrink the workload or skip a platform to pass a check.

Budget enforcement also changes calls that succeed today, so it ships only in a breaking release.

## Evidence and related contracts

- [Completed asset retention and project cleanup](../../guides/sdk/0002-assets.md#read-and-cancel)
- [Complete-version storage and deduplication](../../../packages/pstdio-storage/src/services/asset-bytes.ts)
- [Asset paths scoped by workbench and extension](../../../packages/pstdio-storage/src/storage/asset-byte-paths.ts)
- [Snapshot assets include retained receipt references](../../../packages/pstdio-sync/src/asset-transfer.ts)
- [Assets download before snapshot application and local submission](../../../packages/pstdio-sync/src/synchronize.ts)
- [Sync is exercised only by tests](../../../packages/pstdio-db/src/services/extension-storage/grouped-storage-sync.integration.ts)
- [Shared files have no journal](../../../packages/pstdio-api/src/features/extensions/command-environment/artifacts.ts)
- [Journal retention and restore rules](../../references/architecture/0026-synchronization-contracts.md#replay-snapshots-retention-and-restore)
- [Local save and synchronization outcomes](../../references/sdk/0004-storage.md#edits-and-outcomes)
- [Read revisions name journal operations](../../../packages/pstdio-sync/src/projection.ts)
- [Saving rebuilds the captured revision](../../../packages/pstdio-sync/src/authoring.ts)
- [Asset verification currently precedes retry lookup](../../../packages/pstdio-sync/src/storage.ts)
- [Connection-owned browser collections](../../../packages/pstdio-dashboard/src/lib/sync/collections.ts)
- [PS-735 workload and production work still required](0007-synchronization-contracts.md#handoff-and-remaining-work)
