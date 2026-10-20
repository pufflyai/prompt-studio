# Synchronization contracts

The private `pstdio-sync-contracts` package defines wire protocol 1 and an executable
reference for the v0.1 synchronization model. The protocol 2 replacement contracts
are defined in [covered checkpoints](0027-covered-checkpoints.md); their production
cutover is separate. The owners below currently build on protocol 1:
grouped local storage in `pstdio-sync` and `pstdio-db`, the relay in `services/relay`,
account authority in `services/account-manager`, and an opt-in runtime connection in
`pstdio-api`. They are on `main` but in no release.

[PRD 0014](../../requirements/platform/0014-local-first-sync.md) replaces this design
with client-side merging and a relay that cannot read content. This reference
describes the current code until that work replaces it.

## Package and ownership

Import schemas, types, fingerprint validation and compatibility checks from
`pstdio-sync-contracts`. The main export uses Zod and Web Crypto, with no Node,
Bun, host, SDK, UI, database, Yjs or provider imports. `./conformance` is a separate,
test-only export. Its development dependencies are not a runtime implementation.
[Package boundaries](0013-package-boundaries.md) record this layer.

| Owner | Responsibility |
| --- | --- |
| Contracts, PS-744 | Versioned envelopes, validation and executable semantics. |
| Identity, PS-745 | Persist stable IDs, map local folders/environments, isolate credentials and caches. |
| Assets, PS-747 | Immutable content references, streamed persistence, integrity, completion and recovery. |
| Storage/SDK, PS-746 | Journal, accepted state, atomic local saves, authoring operations and conflict inspection/resolution. |
| Relay, `services/relay` | Authorization, immutable publication checks, atomic PostgreSQL publication, durable replay/snapshots and restore epochs. |
| Account manager, `services/account-manager` | Account lifecycle, devices and cloud projects; independent from content restore. |
| Native connection, `pstdio-sync/relay` and `pstdio-api` | Device login, access renewal, snapshot download, submission, recovery and view refresh. |
| Extensions | Data models, domain validation and pure local handlers from published packages. |

The [kernel storage API](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage.ts)
adds `storage.assets` and grouped `storage.records` through the public SDK and host adapter.
The older key-value and collection methods remain and are marked `@deprecated`, following
[API versioning](../extensions/0014-api-versioning.md). Only nightly SDK builds contain the new methods.

PS-758 implements the internal PostgreSQL persistence owner in `services/relay/src/storage/`.
It reuses the production record evaluator and pure resolution validator from `pstdio-sync`.
Account/workbench/extension scope rows serialize independent writers. Current records,
conflict metadata, one canonical operation body, its outcome, and the accepted replay
sequence commit together. Supersession is derived from accepted resolution captures;
it is not another stored status. Test-only references remain independent from this owner.

The owner provides repeatable-read snapshots and contiguous accepted replay. Restore
validates receipt fingerprints and the immutable bytes required by retained history,
replaces scoped content in one transaction, and creates a new epoch. Old receipts keep
their saved acknowledgments. Replay after restore begins at the restored sequence in
the new epoch. It does not erase receipt ancestry or use a TTL to discard offline work.

This internal scope is not authorization. PS-768 adds authenticated HTTP and finite
WebSocket subscriptions in `services/relay/src/transport/`. They check finite access
from the account manager and derive current grants and published revisions. PS-760's
production S3 owner keeps scoped upload intent and acknowledged multipart parts in
PostgreSQL. Each upload has its own object key. Completion streams the durable object
through full SHA-256 and length verification before publishing the verified mapping
and upload receipt in one transaction. Lost completion responses and process restarts
recover that intent without accepting unchecked bytes. Conditional ETag reads detect
changed objects. Cancellation commits its durable row and PostgreSQL notification together,
interrupts writers across owners, and drains the writer before removing only its temporary bytes;
completed objects stay available through publication and retained history without a TTL.
Asset routes use the same authenticated transport. RustFS evidence does not
establish live Spaces compatibility. See the [relay guide](../../guides/development/0006-relay.md) for migrations,
isolated PostgreSQL/process-kill checks, and the built persistence smoke.

## Local staged assets

The local runtime implements immutable `{sha256, byteLength, mediaType}` references through
`pstdio-storage` and the API's asset-transfer service. The storage package owns streamed bytes and integrity checks;
the API owns persisted operation identities and cancellation. It resolves ownership from the actual project extension instance
to stable workbench and extension IDs. Local paths and credentials never enter portable references.

An operation binds its expected reference once. Temporary file size supplies its resumable offset, including after restart.
Only a fully verified file can be linked atomically into the immutable version store. A retry finds the same version;
it cannot replace its bytes or change the operation's expected reference. No duplicate progress or completion flag must be kept in sync.
Reads stream and verify content, and consumers must reach the end before marking a download verified.

Disconnection preserves partial bytes. Explicit cancellation first interrupts active writes, persists cancellation,
and removes eligible temporary bytes. Retrying reads after restart finishes any interrupted cancellation cleanup.
Completed versions are retained without automatic expiry or garbage collection. This makes verification safe from
temporary-upload cleanup while the grouped-storage child commits references. Future manual cleanup must account for
accepted content, pending work, unresolved alternatives, and backups before deleting any completed version.

`ctx.storage.assets.stage`, `getTransfer`, `cancel`, `read`, and `verifyComplete` are the narrow extension boundary.
`client.assets.upload` owns chunking and mechanical transport retries. Existing buffered blob calls remain supported;
their HTTP adapter now streams local persistence and download. See the [asset guide](../../guides/sdk/0002-assets.md).
New legacy blobs encode workbench and file IDs under a separate `files` directory. Existing rows keep their stored paths
for reads, updates, and rollback. Project cleanup deletes only its database-owned file paths and readable siblings;
it never derives a recursive directory from an opaque identity or removes retained asset versions.
Grouped commits, relay storage, and grants live in the owners above. Backup scheduling and full offline readiness are not implemented.

## Local UI sync and relay ownership

`environmentIdentitySchema` and `environmentTargetSchema` define stable runtime identities and exact execution targets. The local runtime persists one identity and reuses project IDs for workbenches. Its workspace records supply local folder bindings. See [projects](0015-projects.md#workbench-and-environment-identity).

The exported `dataOwnership` map is the explicit relay boundary. Workbench content, assets, published extension/catalog revisions, and automation definitions belong to the workbench. Sessions, processes, workspaces, folders, terminals, credentials, caches, and development overrides belong to an environment. Published extension state must be selected explicitly; installed local sources and overrides are not publication records.

The dashboard's local SSE stream sends 11 tables: `board_views`, `board_default_views`, `settings`, `projects`, `installed_extension_sources`, `notifications`, `extension_instances`, `sessions`, `workspaces`, `files`, and `workspace_sessions` ([source](../../../packages/pstdio-api/src/features/sync/get-full-state.ts)). A delete sends its `sync:delete` events, including rows removed by cascade, only after the database delete succeeds; see [real-time updates](../../requirements/platform/0003-realtime-updates.md). These tables mirror one runtime for its UI and are not a replication allow-list. A relay must never copy those tables as shared workbench content. Dashboard collection data, indexes, readiness, and subscriptions belong to the API connection; disposing a connection closes its stream and releases its collection store. Browser credentials are scoped to the selected API origin, including its port. CLI clients capture their runtime URL and credential together.

A runtime starts relay synchronization only after `pst login` registers it as a device. It then syncs every cloud project of the account that exists locally ([device login](../../guides/development/0011-device-login.md)). Without a login, the runtime stays local. An account ID in a protocol envelope remains data, not proof of authorization.

## Identity and immutable requests

`Scope` contains `accountId`, `workbenchId`, and `extensionId`. A `recordId` is unique
inside that scope. `environmentId` identifies the originating local runtime, not a
path, session, Git workspace, access token, or account. IDs are opaque, stable,
nonempty strings; their persistence and authentication belong to the owners above.
The relay binds account and environment to current authorization before any access.
No wire ID grants access by itself.

An operation ID is unique within the extension/workbench/account scope and is never
reassigned, even after restore, deletion, conflict, or a lost acknowledgment. Record
IDs cannot be reused to bypass a retained tombstone. A mutation has one change per
record, one protocol version, one originating environment, and explicit parent IDs.
Parents represent causal dependencies between grouped mutations, not device clocks.

The fingerprint covers the whole mutation body except the fingerprint itself.
`canonicalJson` sorts object keys, preserves array order, uses JSON scalar encoding,
and omits absent optional properties. SHA-256 is lowercase hexadecimal over UTF-8.
JSON cannot contain undefined array elements, nonfinite numbers, or non-JSON values.
`sealMutation` constructs a validated envelope; `validateMutation` checks structure
and digest. A matching operation ID and digest returns the existing terminal receipt.
A changed digest is rejected. Pending receipts bind the ID too, but can progress
when bytes or parents become available. Reordering a meaningful array changes the
digest. Peers must retain and retry the original sealed payload, never regenerate it.
Fingerprints detect identity/content mismatch; they are not signatures or permission.

## Authoring operations and wire representation

[Authoring inputs](../../../packages/pstdio-sync-contracts/src/authoring.ts) describe
behavior, not SDK signatures. The SDK signatures are `storage.records` in
[storage records](../../../packages/pstdio-api-contracts/src/extension-kernel/types/storage-records.ts).
Commands are scoped through an authorized storage context. Grouped edit, revisioned
read, status inspection, conflict inspection and resolution are available to agents
and extensions without exposing Yjs documents. The dashboard has no view for them yet.

| Input | Supported reconciliation |
| --- | --- |
| `text.insert`, `text.delete` | Translate indices from the current local view into stable Yjs sequence operations. Concurrent inserts survive; overlapping deletes are idempotent. No whole-document replacement during remote delivery. |
| `list.insert`, `list.delete` | Insert JSON elements or delete existing sequence elements. Concurrent insertions survive. Deleting an observed element cannot delete an unseen concurrent insertion. List elements are atomic JSON; nested edits and moves are not inferred. |
| `map.set`, `map.delete` | Changes to different explicit keys commute. Each key checks the captured cell fingerprint, including whether the key exists. Repeated edits to a key within one local group use the final edit and the original cell fingerprint. Keys can be any string, including an empty string. Same-key divergence preserves alternatives. Values are atomic JSON, not recursively merged. |
| `replace` | Replace an arbitrary JSON value only when its captured value fingerprint matches. Different JSON fields do not establish semantic compatibility. |
| `asset` | Versioned immutable `{sha256, byteLength, mediaType}` reference, including zero-byte content. Compare the captured base or identical next reference. Competing replacements preserve bytes and alternatives. |
| `deleted` | Tombstone or explicit restore. Check the deletion state and exact record revision. Never silently resurrect an offline edit. |

Each record has one shared primitive kind once established. Primitive conversion
requires a separate future contract. A record can also carry an atomic JSON value
and asset reference. A mutation may edit several records and references together.

Text/list wire changes carry internal base64 Yjs state updates; the reference uses
record-scoped documents. Their encoding is part of protocol 1, not the public
extension API. Maps carry explicit key preconditions and set/delete operations.
Indexes never travel as replay instructions. No Yjs object crosses the SDK boundary.
A production receiver must validate update encoding and consistency before staging.
The reference decodes real updates and rolls back invalid transactions. JSON and dictionary validation preserve all permitted property names, including `__proto__` and `constructor`.

`expectedRevision` is the record version observed in the author's working branch.
Accepted record revisions advance once per accepted group touching that record.
Text/list and explicit map-key checks allow supported concurrent divergence; JSON
and assets use their own base preconditions. Future or incompatible bases preserve
a conflict. Parents gate pending descendants until accepted. They cannot be replaced
by comparing integer revisions alone. Local revision projection applies an active
replacement once, rather than counting both it and its captured pending branch.

## Transaction and acknowledgment boundaries

Local storage serializes callers and durably saves the full group, ordered pending
journal entry, identity, and required bytes before reporting `saved-locally`. The public SDK accepts caller-observed revisions for read-modify-write. An edit without `expectedRevision` bases on the record's current revision in the local working view when the group is authored. Local
working state is derived from accepted state plus active pending branches. It is
not a third authoritative stored copy. An online stale save still preserves the
proposed work and returns revision/conflict information; core never reruns arbitrary
extension commands with external effects.

The relay validates structure, identity/digest, authorization, parents, asset
completion and preconditions. It applies all records to temporary candidate state.
On any unsupported edit it retains the complete group as a conflict alternative.
No candidate record is published. Missing assets or unaccepted parents return
`pending`; unrelated groups can progress. Known conflicts keep their whole group,
including dependent changes to other records.

Commit candidate records, tombstones, receipt, conflict metadata and replay boundary
in one database transaction. Only then acknowledge or notify. Before-commit failure
publishes nothing. After-commit acknowledgment loss returns the original receipt on
retry. Bytes are immutable and must be verified complete before the transaction can
publish their references. Production asset completion must prevent cleanup racing
this transaction. Notifications are hints; the current local event bus is not a
durable replay log.

`Receipt` retains the sealed mutation, digest, outcome, stable journal order and
acceptance checkpoint. `syncOutcomeSchema` names `saved-locally`, `pending`,
`synchronized`, and `conflict`. The public `StorageSaveOutcome` adds a `state` derived
from that status: `saved-locally`, `waiting-to-sync`, `synced`, and `needs-attention`.
A synchronized result describes relay acceptance;
it does not mean every peer has received it or that initial download is complete.
Offline readiness requires all records, packages and bytes to be locally complete.

## Conflict alternatives and resolution

Normal reads keep the first accepted version and conflict metadata. Retain complete
alternative envelopes and their referenced bytes; do not create duplicate domain
records. A conflict has its own monotonic revision. Any accepted edit or new
alternative touching its records changes that revision. Inspection must expose
accepted inputs and all alternative operation IDs and payloads to authorized callers.

A proposal names `conflictId`, `expectedConflicts` for every covered conflict, exact `expectedInputs`,
and `capturedOperationIds`. Captured operations must be retained nonaccepted members
of the root's descendant branch and its complete nonaccepted prerequisite closure, in ancestry order. Joined branches capture whole prerequisite groups, including their other records. Every captured record must be
included; duplicate records, missing input checks, self-dependencies and unrelated
captures are invalid. Captured operations are also parents. Other parents must have
accepted receipts. The relay checks causal closure, membership and every covered conflict/input revision atomically. An unaccepted parent cannot be bypassed by capturing only its child.

A proposal may replace only its captured branch. A resolution carries that branch's
complete sequence state, merged with current accepted sequence state, and explicit
choices for incompatible values/assets/map keys. Its accepted receipt supersedes
only the named operations. Later edits depend on the active replacement and remain
pending until their own acceptance. A stale rejected proposal stays retained and
is included in the next replacement's captured ancestry. Never delete the old branch
because a proposal was merely sent. Third-client alternatives outside a capture
remain retained and require their own decision. Derive supersession from accepted resolution receipts so a previously captured proposal is never reopened. A late proposal against an already resolved root gets a new unresolved conflict identity so it can be inspected and proposed again.

Automatic handlers run locally, are pure, and have no external effects. Proposals
include the published immutable package revision and handler ID. The relay compares
that revision with the workbench publication and checks all expected conflict/input
revisions. It never runs extension code or trusts a local development override.
Unavailable handlers leave the conflict inspectable. Explicit proposals use the
same revision checks without requiring a handler field. The relay authorizes callers,
and the native connection initializes each scope with the installed source revision.
The fixture uses a publication marker.

## Local read projections

Accepted state and the immutable journal are the only durable storage authorities.
The database storage service owns a disposable projection cache, with at most 32
owner/environment entries per service. Each entry contains the working records,
operation outcomes and conflicts derived by the same projector used for recovery.
There is no writable working-record table.

Each owner row has an opaque UUID revision. The storage transaction changes it
when appending operations, changing acceptance or recovery evidence, or replacing
accepted state. The token commits with those changes under the owner lock. A
journal ordinal alone would miss acceptance-only changes; snapshot checkpoint
counters would miss pending work and conflicts. A new owner receives a new token,
so deleting and recreating an owner cannot revive its previous cached records.

Ordinary record reads, outcomes, conflict summaries and deprecated KV/collection
reads first fetch only this token. A matching projection serves the read without
loading the journal or acquiring the owner write lock. Single-record work depends
on that record's payload and revision ancestry, rather than unrelated retained
history. Listing still scans current records. Callers receive
copies of cached values and metadata.

A committed local append advances existing projections through only the new
operations. The service copies the derived view and appended payloads so issued
views stay immutable. Copying this derived state still costs work during writes;
only replay is limited to the appended operations. The new view becomes available
after the transaction commits. Failed transactions publish no cache changes.
Acceptance changes and accepted-state replacement discard old projections. This
also covers epoch, snapshot frontier and document-generation changes represented
by a replacement snapshot, even when checkpoint counters do not change. Any
future history compaction must update the owner token in its storage transaction.

A cache miss rebuilds from accepted state and the retained journal under the
owner lock, including any legacy import in the same transaction. Eviction,
independent service instances and process restart use this same recovery path.
The cache does not change durability, stale-write guards, conflict retention or
public storage contracts. Writes, branch inspection and recovery can still read
retained history; this cache does not implement history compaction.

## Replay, snapshots, retention and restore

The current protocol 1 owners use checkpoints of `(epoch, sequence)`, whole-group
replay, and retained receipts. Replay cursors outside the retained range or epoch
require snapshots. A content restore starts a fresh epoch and never restores grants.
Local reconnect preserves newer accepted and pending work and their source bytes.
These owners do not implement production compaction yet.

PS-808 replaces permanent receipt retention with the
[covered checkpoint contract](0027-covered-checkpoints.md). Protocol 2 snapshots
carry current records, required tombstones, explicit retained branches, document
generations, writer floors, and outstanding receipts. Coverage requires durable
installation by every enrolled environment and an independent verified backup.
Offline environments, active recovery, retained ancestry, and in-flight publication
or capture restrict the cut. There is no time-based expiry.

Generation retirement replaces covered terminal outcomes with per-environment
floors and preserves outstanding exceptions. Late old-generation operations require
resynchronization with their proposals intact. Document rotation fences all writers
and publishes one shared fresh CRDT seed. Deletion follows committed retirement and
rechecks reachability under the publication boundary. Backup manifests own independent
copies; restore starts a new epoch and preserves newer local recovery proposals.

The isolated reference proves these rules; PS-776, PS-780, PS-781, and PS-782 own
production editing, backups, compaction, and restore. Do not apply protocol 2 deletion
rules to protocol 1 production data before the paired host/relay cutover. There is no
mixed-client fallback or historical conversion in this alpha redesign.

## Compatibility

Peers advertise supported wire versions, supported features and required features.
Release labels are diagnostic and do not select a protocol. Negotiate version 1 only
when both support it and every required feature is supported in both directions.
Optional features are ignored unless required; unknown mandatory structure and
unknown envelope fields are rejected. This contract does not claim future version
support merely because two peers advertise the same unknown number.

An unsupported result is actionable and recoverable. Keep the original durable
journal and bytes, do not send or rewrite queued envelopes, and retry after a local
runtime or relay update. Schema evolution needs a separately versioned decoder and
compatibility evidence before enabling a new wire version.

## Executable evidence

Run from the repository root after `bun install --frozen-lockfile`:

```sh
bun run --cwd packages/pstdio-sync-contracts test
bun run --cwd packages/pstdio-sync-contracts typecheck
bun run --cwd packages/pstdio-sync-contracts lint
bun run --cwd packages/pstdio-sync-contracts test:conformance
bun run verify:boundaries
bun run verify:lockfile
```

The production owners have their own Docker-backed suites. CI runs them in the
`relay_smoke` job: `bun run --cwd services/relay test:storage`, `test:assets`,
`test:transport`, and `test:isolated`, `test:conformance` with
`SYNC_TEST_ENTRY` set to the production-relay entry
(`packages/pstdio-db/src/services/extension-storage/grouped-production-relay.integration.ts`),
and `bun run --cwd services/account-manager test:isolated`.

`registerConformance` takes a structural adapter factory so later storage/relay
implementations can reuse the scenarios. `createReferenceFixture` supplies disposable
PGlite databases for three environments, PostgreSQL row transactions, and RustFS
objects. The command creates a named Docker stack, exposes no database/object ports,
mounts source/dependencies read-only, and removes its containers/network/volume in
`finally`. The default test subnet is `10.254.236.0/24`; set `SYNC_TEST_SUBNET` to an
unused subnet for concurrent stacks. It never opens the application's database.
Its test tables and fault controls are not production migrations or service APIs.

Snapshot requests capture the current accepted state before network work. Install
a response only if that observed state still matches, including receipts and
conflicts. Receipt outcomes can change without advancing checkpoint counters.
Within one epoch, older journal or accepted positions cannot replace current
state. A fresh restore can start a new epoch at a lower position. Local pending
edits remain in the journal during this check.

The source cases were inspected at WS-272 commit `565ceab57` in
`infra/relay/prototype/src/{protocol,staging,client-model,recovery}.ts` and adjacent
tests. That branch's `0026-cloud-sync-prototype.md` is evidence, not a merged
prerequisite. The fixture ports the protocol failures and adds map/list, third-client,
handler revision, compatibility, canonical fingerprint and resolution-restore cases.
It uses throw-based faults immediately before commit and after commit/before receipt,
and closes/reopens durable client stores. This suite alone does not establish OS-kill
recovery, WebSocket delivery, or revocation; the relay storage, transport, and account
manager suites cover those. Production backups and Spaces behavior remain unproven.
No production service from the prototype is imported.
