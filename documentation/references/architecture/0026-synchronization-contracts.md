# Local CRDT storage

Each extension record is its own Yjs document ([ADR 0100](../../adrs/0100-one-document-per-resource.md)).
A declared text file uses its own document. An extension's records sync together through one
encrypted record stream ([ADR 0102](../../adrs/0102-record-stream-sync.md)). The runtime owns merging and persistence. Extensions keep
using `storage.records`, the deprecated KV and collection methods, and the file APIs.
[PRD 0014](../../requirements/platform/0014-local-first-sync.md) defines the requirements.

## Ownership

| Package | Responsibility |
| --- | --- |
| `pstdio-sync` | Record and text engines, transient presence, encryption and relay transport, separated by module APIs. |
| `pstdio-db` | Durable document state, atomic current-record projections, query indexes, incremental updates, local retry identities, migration versions and the one-time journal import. |
| `pstdio-api` | Public storage adapters, verified assets, file projection and notifications after local commits. |
| `@pstdio/sdk/testing` | The same document engine with an in-memory store. |
| Extensions | Domain data and validation, without merge rules or relay code. |

The [blind relay](0029-blind-relay.md) stores encrypted payloads. Clients seal them with
the functions in `packages/pstdio-sync/src/encryption/` and keys from the account manager
([ADR 0085](../../adrs/0085-encrypt-sync-data-with-account-manager-keys.md)). Document
transport and latest-state uploads run in `pstdio-sync/src/relay/`. The runtime starts
encrypted document sync for each enabled extension. Local reads and saves do not wait
for the relay.

## Sync modules

The private package has six entry points. Consumers import the module that owns the
operation instead of a root barrel that exposes every implementation.

| Entry point | Owns | May depend on |
| --- | --- | --- |
| `pstdio-sync` | Shared storage ports, document history and byte utilities | Synchronization contracts and Yjs |
| `pstdio-sync/text` | Plain shared text, initial histories, adoption, file diffs and browser replicas | Shared ports |
| `pstdio-sync/records` | Structured values, resource lifetimes, record queries and record-to-text bindings | Shared ports and text |
| `pstdio-sync/presence` | Transient, connection-owned participant values and leases | Shared owner identity |
| `pstdio-sync/encryption` | Sealing, opening and sync-space keys | Shared byte utilities |
| `pstdio-sync/relay` | Encrypted document and record-stream transport | Shared ports, records, text and encryption |

The text engine has no Markdown, Monaco, React, HTTP or database dependency. Its
replica owns received history and pending local frames. Workbench sessions supply
the host client, connection lifecycle and close guard. Editor bindings own rendering,
selection mapping, composition and undo. Adding a code-editor binding should reuse
this text engine; it should not create another relay or persistence implementation.
The current native host adapter still admits Markdown views only.

Presence carries a caller-defined value. An icon editor can share selected icon IDs;
a text editor can share history-relative selections. The host adapter validates and
encodes its wire values, authenticates connections, owns heartbeat timers and supplies
the transport. The presence engine never writes a database, file or update journal.
The existing native-text wire protocol and its limits remain unchanged.

Record and text data remain separate authorities for different data shapes. A ticket
form uses record operations for structured fields and a bound text document for its
body. Two editors of the same field must use that same authority. Raw JSON source
editing does not automatically provide structured JSON merging or syntax validation.

Database adapters and indexed projections stay in `pstdio-db`. Source authorization,
HTTP endpoints and physical file saves stay in `pstdio-api`. Extension declarations
stay in the public SDK. UI components remain outside `pstdio-sync`.

`verify-boundaries.ts` checks this module dependency graph. Production imports across
modules must use their entry points. Text and presence cannot import record, relay,
host or editor implementations. Public workbench bundles inline their private text
engine dependency; published packages do not require a private workspace package.

## Indexed current records

[ADR 0099](../../adrs/0099-durable-record-query-projections.md) separates reads from
merge-state loading. [ADR 0100](../../adrs/0100-one-document-per-resource.md) gives each
record its own Yjs document. A commit loads only the documents of the records it names. In one
durable transaction it writes their CRDT updates, their current rows and content revisions,
the operation identity, and the owner revision. Only after that transaction commits does the
service notify listeners.

Normal queries, aggregates and batch reads never load a record document. Predicates, stable
sorting, cursor seeks, field selection and limits run in SQL. A cursor rejects a changed owner
revision. Owner metadata writes, such as data migration versions, do not change that revision.
The public methods and typed field semantics are in the
[storage reference](../sdk/0004-storage.md#indexed-queries).

The owner document keeps owner metadata, such as data migration versions and the text document
directory, and syncs as its own relay document. Records sync through the record stream below.
Projection rows and record documents are removed with their workbench and cleared with an owner
purge.

Core resource numbers use one record each under the `pstdio` owner. Each record holds
the resource ID, extension, kind, prefix, current number and number history. Allocation
locks that owner and reads the highest numeric value from the prefix's identity and
alias indexes. It loads and writes only the new record. History includes every assigned
number, including the current one after repair; public identity reads filter the current
number out of `aliases`.

The same record transaction maintains the identity and alias indexes for local saves
and incoming record-stream changes. It examines only collision keys touched by the save.
The lower resource ID keeps a colliding number. Other resources receive the next free
number, and retain both the old and newly assigned numbers in their history. This also
preserves numbers shown during concurrent repairs with different allocation floors.
Events are delivered after the transaction commits. The projection revision follows
the core record owner revision; reads reject an incomplete projection.

The first number operation moves an existing `resource-identities` document into records
in one transaction. It rebuilds the old derived indexes and removes the old source only
with the final record save. Failure leaves the source available for a later start.
Before founding a new core record stream, a device also reads and imports the old relay
document. This recovers remote-only numbers when older devices are offline. Once the
records join a stream, the old source is no longer read. An empty project has no stream
yet and rechecks the empty source on reconnect. An existing stream is authoritative;
normal synchronization uses the record stream from
[ADR 0102](../../adrs/0102-record-stream-sync.md).

## Scheduled automations

The core `pstdio.automations` owner uses the same encrypted document transport as
extensions. Each schedule record holds `deviceId`, `enabled`, and `startsAt`. No
automation data or disable acknowledgment is stored separately on the relay.

Schedule admission checks the current device before arming and again just before
command dispatch. Unassigned cloud schedules stay idle. The local
`pstdio.automation-runs` owner never joins sync. Its claim and cursor commit together
before effects. It records missed occurrences as skipped and does not replay claims
after restart. See the [schedule reference](../cli/0010-scheduled-automations.md).

## Data merges by shape

A save compares the submitted value with the current document at every depth:

- Objects change only their changed keys. Named child maps let concurrent creation of
  the same nested object merge its keys too.
- Lists keep values in an item map and their sequence in a Yjs array. An object's `id`
  supplies its identity. Other values use their canonical JSON and occurrence number.
  Concurrent moves may leave more than one sequence reference; reading selects the last
  visible reference, so each item appears once. Removing the item hides later nested edits.
- Strings use Yjs text after their first line break, and stay text after the line break
  is removed. Promotion gives both devices the same original character identities.
- Other values, including single-line strings, use Yjs map replacement. Concurrent
  replacements follow Yjs ordering. Wall clocks do not decide the winner.

Child references use deterministic paths inside a document. Their content lives in
named Yjs types, so a concurrent parent assignment cannot discard another child's
edits. A deleted reference hides its children. Deleting a record removes its live
reference and records a tombstone. A concurrent edit to its fields cannot restore it.
An explicit `deleted: false` can create a new live record.

`records.commit` validates the whole group before changing Yjs state. Every edit in the
same group runs in one Yjs transaction and becomes one durable database update. Invalid
shared sequence ranges cannot leave an earlier record half saved. `expectedRevision`
is accepted and ignored. Read revisions are content hashes for observation; they do not
carry or replay operation history.

The deprecated collection stores `{ value, sortOrder }`. Its `value` is a nested shared
object, so fields inside the item merge independently. Legacy conditional operations
still read and change data under the same owner lock. Collection listing filters the
namespace before materializing values.

## Durable local state

[Document storage](../../../packages/pstdio-db/src/services/extension-storage/document-storage.ts)
uses three tables:

| Table | Content |
| --- | --- |
| `storage_documents` | Saved Yjs state, document revision and the revision folded into the saved state. |
| `storage_document_updates` | Incremental updates written after that state. |
| `storage_document_operations` | Indexed local operation IDs and input fingerprints for retry outcomes. |

The document address is the project, extension and document ID. The extension's
records use `records`; text files use a separate address based on their stable file ID.
Foreign keys remove these rows when their project or document is removed.

A database transaction locks the document row, checks its revision and loads the saved
state plus its remaining updates when needed. A bounded cache reuses a matching loaded
document. A save appends only its new update. Every 128 updates, the same transaction
writes a new saved state and removes the folded updates. Normal saves and reads do not
load the old grouped journal. Retry metadata stays outside the CRDT state, so folding
does not copy every past save ID.

The PGlite adapter uses native hex conversion for binary values. This avoids a
JavaScript callback for every byte in a large saved document; values still use the
same Uint8Array database contract.

The cache is published and listeners run after database commit. A failed transaction
discards the cached document. Another service checks the database revision before using
its own cache. A save returns `state: "saved-locally"` only after the local transaction
commits. Relay synchronization runs separately from that local save outcome.

An explicit extension data purge replaces its documents with empty snapshots and
clears their updates and retry identities. Revisions keep increasing across the purge,
so every running service drops its old cache. Migration metadata resets with the
content. An empty migration checkpoint alone does not count as user data for uninstall.

Assets remain immutable, verified content references. The asset service verifies bytes
before a record can refer to them. Shared artifact mounts and attachments keep their
existing public APIs. File projections still check workspace permission and on-disk
identity before replacing bytes downloaded while an editor was saving.

`openTextDocument` is the internal host port for a declared text file. It persists a
Yjs text document even for single-line content. Binding native editor collaboration to
that port is separate from this storage implementation; ordinary artifact files still
use verified asset references.

## Recovery points

[Recovery points](../../../packages/pstdio-db/src/services/extension-storage/recovery-points.ts)
let a person restore a cloud project, or one extension in it, after a mistake has synced. A
point covers one project. For each extension with data it keeps:

- the live records at one owner revision, read from `storage_current_records`;
- the text of its text documents;
- its data migration markers from the owner document.

A point never encodes record documents. One transaction reads the whole project and holds the
owners' projection rows, so every owner is captured at one revision. An owner whose revision has
not changed since a kept point reuses those saved records. Capture and restore of one project run
one at a time, so a point never holds a half-finished restore.

`recovery_points` has one row per kept point and `recovery_point_owners` one row per extension
in it. The slots are fixed: the last hour, 12 hours and day, so a project never has more than
three points. A point is replaced when it is older than its period. When the free disk space
cannot hold every due point, or a write fails because the disk is full, only the 12-hour point
stays. There is no fixed quota or reserve. A cloud project gets its first point after its first
full download. Projects with points keep rotating them while the device runs, even offline.

A restore first checks that every saved file is still on the device, and changes nothing when one
is missing. It then compares the saved records with the current projection and commits the difference
with normal `records.commit` groups for each owner. These commits notify storage listeners and
sync like any other edit. A record brought back after deletion gets a second pass, because its
document keeps its old shared value. Text documents and migration markers are set back through
their documents. Before it writes, the restore saves the current state in the hour point, or in
the 12-hour point when there is no hour point, so the restore can be undone without a fourth
point. A restore that would change nothing keeps every point. Purging an extension's data also removes it from recovery points.

## Record stream

Each extension owner syncs its records through one relay document, named
`[extensionId, "record-stream"]` before hashing. The transport lives in
`pstdio-sync/src/relay/record-stream.ts`; `pstdio-db` implements its store in
`record-stream-store.ts`.

| Part | Rule |
| --- | --- |
| Update | One local save: an encrypted frame with each changed record's Yjs update and the files those records use. A frame too large for one update is stored as a blob that the update names. |
| Outbox | `storage_record_outbox` keeps a save's frame, written in the save's transaction. Only owners with a `storage_record_sync` row keep one. |
| Download | A page of frames, the records they change, their query rows, the owner revision and the cursor in `storage_record_sync` commit in one transaction. |
| Latest state | Encrypted chunks of record states, stored as blobs. The first one founds the stream. Later ones are built only by a device that has read every update and has an empty outbox, so they add nothing an update did not carry, and only once the updates outgrow the latest state. |
| Joining | The first device with records founds the stream. A later device adopts each record's synced history and reapplies its own changes since it first saved the record; a history the stream already shares merges normally. |

A save inside a data migration uses deterministic Yjs authors per record document, so two devices
that run the same migration write identical updates.

## Encrypted document transport

A connection keeps an in-memory replica of what the relay holds and a sequence cursor.
It opens the latest state, checks its encrypted Yjs state vector, and reads every later
update. If a latest state changes during pagination, reading restarts at its boundary.
The uploader may have seen fewer updates than this reader. Each completed page is
saved locally before reading the next, so an incomplete replacement cannot erase edits
that this device already received.

Downloaded data merges into the durable local document. It never replaces it. The
client compares its document with the relay replica and sends missing edits, even
without a new local save. The comparison also includes Yjs deletion sets, since state
vectors alone cannot describe deletions. This repairs an incomplete latest state and
keeps edits made while a device was offline across several state replacements.

After more than 1 MiB or 1,000 updates beyond the current latest state, a caught-up
client uploads a full state and encrypted state vector. It names the previous state
and its last included sequence. A stale compare-and-swap response makes the client
read the winner and try again. An offline diff larger than the relay update limit uses
the same state channel with the merged local document. Concurrent tail updates remain.

The records document carries an encrypted directory of local text-document names.
After syncing records, a new device opens those text documents with the same keyed
IDs. Neither filenames nor extension record names appear in relay routing metadata.

Each asset hash has a random blob ID in an encrypted `sync-blobs` map. The local asset
service stores the sealed ciphertext before that ID enters the durable document.
Multipart retries reuse the same bytes. Every outgoing update and latest state lists
its active blob IDs, and every listed blob finishes uploading first. Receivers verify
and decrypt blobs before publishing records locally. Inactive mappings remain for
offline reuse, without keeping their relay blobs alive. If cleanup removed a blob,
the client seals a new one from complete local plaintext.

Unreadable ciphertext, invalid Yjs updates, mismatched state vectors, and invalid blob
metadata are checked on disposable documents. The runtime saves the encrypted envelope
under `PSTDIO_HOME/state/sync-quarantine/` and logs only its opaque identity. Later
healthy updates continue. A client that skipped an update does not compact it away;
large healthy uploads keep that envelope in the update tail.

Blob encryption currently buffers whole files. Uploads resume verified parts, while
interrupted encrypted downloads restart from offset zero. Streaming encryption and
resumable downloads remain separate transport work.

## Upgrade and data migrations

The first records-document open runs the existing projector once for that owner. It
imports the accepted state and current local journal, and any older KV or collection
rows. It also imports the existing per-scope data migration versions. The new document
and removal of the older KV rows commit together. The grouped journal tables stay
unchanged for PS-824; later opens use the document row as the import marker.

Equal projected data gets equal bootstrap identities. Data migrations assign stable
Yjs authors to equal field changes from the same baseline. Two offline devices running
the same migration therefore do not insert the same text twice. Migration completion
is stored in the document as per-scope version markers. Reading the highest completed
version prevents a concurrent older marker from downgrading it, and receiving a marker
prevents running an already received migration again.

Random record IDs created by a migration remain the separate core ID work in PS-842.
Extensions must still follow the migration API's supported version ordering. An older
installed extension cannot migrate data backward.

## Staging save handlers

`captureCheckpoint` runs ordinary storage writes against a document fork. It returns
one Yjs update after the handler succeeds. The original document and materialized files
stay unchanged during preparation. Applying the update publishes the complete group;
a failed handler discards all staged edits. This replaces receipt and journal-parent
capture. Storage observations report current versions and no longer enforce stale
revision conflicts.

The deprecated `conflicts` method returns an empty list. `inspect` and `resolve` report
that records merge automatically. Their public declarations remain until the planned
breaking API removal. The old projector and relay evaluator remain only for upgrade and
legacy protocol ownership, not as a second writable extension store.

## Verification

The document tests cover two offline databases, nested fields, identified list items,
list additions/removals/moves, multiline strings, text promotion, deletion versus edit,
atomic groups, durable reopening and repeatable data migrations. The process-kill test
checks local durability before database close. The packaged storage smoke exercises
public APIs through a compiled runtime and restarts it.

[Planner cold-open measurements](../performance/0002-planner-board-cold-open.md) describe
history-independent saves and the separate browser measurement.
