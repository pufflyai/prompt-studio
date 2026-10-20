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

The [blind relay](0029-blind-relay.md) stores encrypted payloads. Encryption, document
transport and latest-state uploads are separate work. The old journal relay cannot
sync this store. Its runtime connection reports that document transport is required.
Local reads and saves keep working.

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

The cache is published and listeners run after database commit. A failed transaction
discards the cached document. Another service checks the database revision before using
its own cache. A save returns `state: "saved-locally"` only after the local transaction
commits. Relay save states will come from document transport.

Assets remain immutable, verified content references. The asset service verifies bytes
before a record can refer to them. Shared artifact mounts and attachments keep their
existing public APIs. File projections still check workspace permission and on-disk
identity before replacing bytes downloaded while an editor was saving.

`openTextDocument` is the internal host port for a declared text file. It persists a
Yjs text document even for single-line content. Binding native editor collaboration to
that port is separate from this storage implementation; ordinary artifact files still
use verified asset references.

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
