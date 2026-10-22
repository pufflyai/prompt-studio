# Local CRDT storage

Extension records live in one Yjs document per extension and project. A declared text
file uses its own document. The runtime owns merging and persistence. Extensions keep
using `storage.records`, the deprecated KV and collection methods, and the file APIs.
[PRD 0014](../../requirements/platform/0014-local-first-sync.md) defines the requirements.

## Ownership

| Package | Responsibility |
| --- | --- |
| `pstdio-sync` | Shape-based edits, document reads, shared primitives, checkpoint staging and legacy namespaces. |
| `pstdio-db` | Durable document state, incremental updates, local retry identities, migration versions and the one-time journal import. |
| `pstdio-api` | Public storage adapters, verified assets, file projection and notifications after local commits. |
| `@pstdio/sdk/testing` | The same document engine with an in-memory store. |
| Extensions | Domain data and validation, without merge rules or relay code. |

The [blind relay](0029-blind-relay.md) stores encrypted payloads. Clients seal them with
the functions in `packages/pstdio-sync/src/encryption/` and keys from the account manager
([ADR 0085](../../adrs/0085-encrypt-sync-data-with-account-manager-keys.md)). Document
transport and latest-state uploads run in `pstdio-sync/src/relay/`. The runtime starts
encrypted document sync for each enabled extension. Local reads and saves do not wait
for the relay.

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
document. A save appends only its new update. After 128 updates, a background worker
merges the captured binary checkpoint and update tail. A short transaction then saves
that checkpoint and removes only its covered updates. Newer updates stay in the tail.
A changed folded revision, including a purge, rejects a stale checkpoint. Normal saves and reads do not
load the old grouped journal. Retry metadata stays outside the CRDT state, so folding
does not copy every past save ID.

The PGlite adapter uses native hex conversion for binary values. This avoids a
JavaScript callback for every byte in a large saved document; values still use the
same Uint8Array database contract.

The cache is published and listeners run after database commit. A failed transaction
discards the cached document. Another service checks the database revision before using
its own cache. A save returns `state: "saved-locally"` only after the local transaction
commits. Relay synchronization runs separately from that local save outcome.

Binary exports read a consistent persisted checkpoint and tail without opening Yjs.
Their merge runs outside the database transaction. Loaded documents also retain the
original binary updates, so exports and folds do not encode every named root again.
Received bytes are persisted even when Yjs buffers them while waiting for an earlier
offline update. An update event alone is not proof that every accepted byte was saved.

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

## Encrypted document transport

A connection keeps a binary replica of what the relay holds and a sequence cursor.
It opens the latest state, checks its encrypted Yjs state vector, and reads every later
update. If a latest state changes during pagination, reading restarts at its boundary.
The uploader may have seen fewer updates than this reader. Each completed page is
saved locally before reading the next, so an incomplete replacement cannot erase edits
that this device already received.

Decode, validation and deletion-aware comparison run in a shared background worker.
Incoming pages stage at most 16 envelopes per job. Owners await their job before
offering the next batch, so already queued owners run first. A rejected update discards
its staged document; only validated updates reach local storage. Blob bytes are verified
before durable acceptance. A failed local commit retains the pending batch for retry.
The worker is an explicit entrypoint in source and compiled builds.

Downloaded data merges into the durable local document. It never replaces it. The
client compares its document with the relay replica and sends missing edits, even
without a new local save. The comparison also includes Yjs deletion sets, since state
vectors alone cannot describe deletions. This repairs an incomplete latest state and
keeps edits made while a device was offline across several state replacements.

Status reuses a comparison only while both the local durable revision and relay
replica revision match. An unchanged database status read fetches revision metadata,
without fetching the binary state or hydrating Yjs. Local writes, deletion-only updates,
purges and relay replacements invalidate the comparison. A changed comparison still
compares binary struct identities and deletion ranges, including retained causal gaps.
State vectors alone cannot describe either missing deletions or unresolved causal bytes.

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
