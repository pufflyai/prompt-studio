# Host-owned shared text documents with transient presence

Proposed: 2026-10-17

## Status

Accepted design for PS-776. Implementation is incomplete. Source-provider and
projection ownership repairs and public session primitives are implemented. Native
bridge adoption, installed editor acceptance and release validation remain open.

This record was recovered from the retained implementation branch as 0117 because
main had independently assigned 0116 to the Firefox test-home decision.

## Decision

Each declared editable native Markdown file view has a standalone document containing one
`Y.Text` of the text returned by its extension's load handler. Markdown is the
authority; a Lexical tree is only its editable view. The document key covers the
extension's declared logical source within the workbench. Views and labels do not
change it. The host resolves declarations from a registered source provider or legacy
file load handler. Browsers supply contribution identities and never choose source paths.

Native views use their existing default-workspace context. An explicit workspace
selector is not part of this identity and is rejected at the native transport
boundary. It must not silently select another worktree's file under the same key.

Updates are durable locally before an edit is acknowledged. Normal encrypted
document sync carries them between hosts. Live text updates and transient presence
use the encrypted live channel. Browsers use their local host, never relay tokens.
Opening or editing one file must not load an owner document or other records.

The extension's save handler still projects the loaded text into its normal files
or records. The host compares outside writes with the last projected source and
applies their character changes to the current shared text. In particular, Notes
keeps its load/save transformation and byte-exact front matter.

## Module ownership

The format-independent text engine and browser replica live in `pstdio-sync/text`.
The structured record engine lives in `pstdio-sync/records`. Connection-owned live
values live in `pstdio-sync/presence`; the native host adapter retains its wire
validation, authorization and timers. Relay and encryption remain separate modules.
The [sync module reference](../references/architecture/0026-synchronization-contracts.md#sync-modules)
defines the enforced dependency graph. Markdown rendering remains in UI bindings;
this refactor does not enable live code or raw JSON editor collaboration.

## Source ownership

The user authorized explicit source declarations for PS-776 on 2026-10-27.
Opaque callbacks remain supported; collaboration requires a declared source.
Views of one source share a standalone text authority and full-source save semantics.
Notes binds its complete artifact Markdown, including hidden front matter. Planner
binds its body field and stable file identities. Extensions contain no sync code.

A merged named map records source ownership. Original record fields and assets
remain immutable bootstrap and late-writer recovery evidence. Ordinary record
writes route bound strings into the standalone text in the same local transaction;
SQL projections expose current strings and revisions. Source resolution and binding
validate the selected record's causal lifetime under the record-owner lock. Initial
independent histories retain the original key. An observed recreation derives a new
key from its existing causal item identity; it cannot inherit retired text. The bind
transaction rechecks the address after asynchronous source loading. No generation
counter or duplicate content is added. Blob and record-backed artifact sources use
the same lifetime rule. Ambiguous old bindings remain recoverable.

Source providers register `resolve` and `project` callbacks without a rendering view.
They run through ordinary extension command execution under the source owner's
permissions. A file can return a local `textDocument` reference. Legacy
`documentSource` stays supported and is deprecated in favor of that reference.
The intended public session and selected-source grant boundary is still required;
the private native session is not acceptance of public editor parity.

One revalidated writable locator owns domain projection for each source. A new
provider reference can replace it only after resolving the same source authority.
Read-only aliases cannot replace it. Removing the original presentation does not
remove projection responsibility.

Each physical file copy records a pending write before mutation and confirms that
exact history immediately after bytes are written. Whole-handler completion uses
a separate checkpoint, so a failed later step cannot make the host undo an outside
deletion. Recheck observed bytes after awaited preparation. Downloaded assets are
bootstrap data, never independent outside edits. An interrupted write with unknown
bytes is preserved and surfaced for recovery instead of guessed.

Imported sources retain immutable original-baseline facts across adoption. Valid
pre-binding differences stop adoption, preserve pending local edits and cursors,
and retain encrypted incoming records, assets or text for recovery. A pointer
without its text is pending data, including when the eventual document is empty.
Known file or source recovery failures retain their durable work and do not prevent
startup from recovering other documents. Corrupt database failures still propagate.

The original two causal failures and subsequent independent reviews are in RP-45.
Planner request `6c4e517f-f95e-4603-9983-8471fdaeb0c7` records the earlier pause;
the later user instruction authorized this implementation without answering that
request on the user’s behalf.

## Initial history and offline edits

A local host seeds an absent text document once, including an empty file. Retain
the immutable genesis update: it identifies the actual original Yjs characters
and provides the initial source for a later adoption. Equal source strings alone
do not prove that independently created histories share those characters.

Before publishing durable or live edits from a new history, a host reads the
remote document. An empty relay document is founded through the existing latest
state compare-and-set. A host that loses the race rereads the winner and adopts
its history. A null state ID alone does not prove emptiness: the relay may already
have an update tail. Recover a complete, valid single seeded history from that
tail; preserve and quarantine an invalid or ambiguous one rather than overwriting
it with a new seed.

Adoption replays only the local changes since its genesis onto the canonical
history. It deletes matching original characters, never the characters a remote
editor inserted between them. It maps local insertions to original-character
boundaries. If the initial sources differ, unchanged local source does not get
appended to the canonical document. Unmatched canonical characters survive, and
local inserted text is retained at the nearest matching boundary, or at the end
when none exists. This is a fixed preservation rule, independent of clocks.

The adoption reads current durable local edits under the document lock after
network waits. Replacing its state, old update tail and cache is atomic. Active
browser connections receive the new seed and state; old-seed deltas cannot restore
the discarded history. Pending browser edits must be rebased before they are
acknowledged. Presence is reset because its relative positions refer to a history.
No separate joined flag is needed for ordinary first joining. A shared genesis
does not alone prove that restored replicas have the same translated history.

### Adoption provenance

Adoption must also work after relay loss, when several hosts carry the same old
edit, and when a previously canonical history returns. Replaying a text snapshot
with fresh Yjs identities on every host duplicates shared insertions. A deletion
set alone does not say whether a user deleted a character or sync removed it as a
duplicate.

Each retired seed therefore has an encrypted receipt in the standalone document.
It retains the old source CRDT state and a range-compressed correspondence between
its characters and canonical character identities. Receipt checkpoints exclude
other receipt payloads so nested snapshots do not grow recursively. Changes to
translated text and its receipts publish together through latest-state
compare-and-set. A loser rereads before translating again. Ordinary same-history
typing remains on normal document updates.

Initial-source correspondence is heuristic; it must never be treated as proof
that two canonical originals are duplicates. Inserted-character provenance is
exact. Only exact equivalences permit duplicate removal. Local editor transaction
updates record authored deletion ranges. Preserving that deletion on an exact
inserted-character representative retains its cause; heuristic genesis matches
do not acquire another deletion origin. Historical delete sets from reconnect
state must not be recorded as fresh editor intent.

The implementation must normalize exact equivalences across all known receipt
paths before removing duplicate characters. Pairwise mapping repair is
insufficient: a return cycle can restore a retired alias outside the current
mapping. This rule also applies to shared-genesis forks recovered from different
receipt contexts. Validate receipt identities, ranges and text ownership before
adopting them. A metadata item inside a document's state vector is not a text
character.

Late browser frames retain the source history and receipt context in which they
were authored. Local room tables retain that source replica and its incremental
update journal. Frames with missing dependencies are rejected without a saved
acknowledgement; the browser repairs them from its original history. Valid edits
are acknowledged after both room persistence and canonical integration. A restart
can replay a committed room frame if integration had not finished. Retries retain
their original identities and deletion intent.

Before sending same-root peer changes to a browser, retain that history in its
room, so the next local edit can reference a received character. Received changes
keep their existing provenance. A retired-root room remains separate until late
frames have been accepted; responses identify both the source and canonical seed.
Never append an old root's bytes directly into the canonical document. Relay
publication still serializes translated histories through latest-state CAS.
Projection retains its own local source/anchor baseline. These local queues and
baselines contain no presence.

Acknowledgements and peer snapshots read durable text without waiting for file
handlers. One background worker per source coalesces projection requests and
flushes again when edits arrive during a save. File errors retain the room and
pending projection, leave editor streams connected, and report the failed file
work. Legacy low-level flush and room close keep waiting for the worker. Public session
flush waits only for the captured durable edit prefix. Its project operation waits
for the corresponding completed revision, without waiting for later edits. Public
close releases a room after canonical integration; the handler row retains unfinished
projection responsibility. Shutdown drains admitted edits and file workers.
The projection worker follows exact durable-document commit events independently
of room membership. A handler row's `completed_revision` identifies the last
canonical revision it projected. Startup pages registered handlers whose canonical
revision is newer, or whose existing pending-write checkpoint remains. This also
finds a crash between canonical commit and worker scheduling, with no open room.
Projection reads state and revision together and advances completion only through
that captured state. Later edits remain dirty. Existing byte checkpoints keep their
physical-copy ownership and matching-write completion rules.
Known unavailable-source failures retain their document and allow other recovery
work to continue. Unexpected database failures remain errors. Background storage
statistics must drain before the database closes, after its writers have stopped.

Known standalone text changes use exact document identities. Their relay work
does not wait for owner discovery, record streams, other text documents, or file
refresh. Open editor sources register directly, including after host restart.
Discovery and exact changes share one serialized worker per replica and coalesce
changes received during a run. Status reads use worker results without loading
unrelated documents. New names also request background directory publication;
owner-directory changes and reconnect discovery cover missed or unknown hints.
Key rotation aborts and drains the retired replica before replacing it. Only its
explicit retirement reason is handled as cancellation; real failures still fail.

Relay storage resets invalidate view reads, resource references, and tab title
queries. The workbench breadcrumb uses that current title. A rename keeps the existing
document identity, editor session, and pending local edits.

The workbench presence service observes connected editors from every open native
document tab. The breadcrumb header shows each remote device once, using its
friendly account name. Device and session IDs remain internal. Views own their
connections and unregister when closed; text and selection updates do not redraw
unchanged chrome presence. The native editor adds no title header or local-save
footer. Save failures still appear beside the document, and the close guard still
protects edits that have not been acknowledged.

Presence follows open placement ownership, not React mount lifetime. The workbench
can retain a closed editor for recovery. That editor pauses its live stream and
leaves presence while keeping its document, room and pending frames. A pending
save can finish without reopening presence. Reopening the tab resumes the same
document. Inactive tabs that are still open continue participating.

## Bounded file access

Opening a native artifact file must not enumerate its owner's other resources or
reconcile every file in the mount. Read the target and its ancestor directory
records by identity. Reconcile only those paths before returning their content.
Full mount refresh and directory listings remain background or explicit listing
operations. They share the same physical projection facts as point operations.

The old owner/root JSON projection file cannot provide bounded point reads. Move
its local path/hash/revision facts into indexed local projection rows, with one
root container identifying an initialized projection. Both point and full
reconciliation read and update those rows. Do not keep separate foreground and
background baselines.

Import existing JSON facts once at startup, only for extension owners and local
workspace roots recorded in this database. Never scan another runtime's home or
import all global cache files into a temporary test database. Commit each root
atomically, using byte-bounded batches; remove its old JSON only after commit.
An already initialized root wins after an interrupted cleanup. Preserve originals
on failure, log the cause once, and keep startup running. An affected mount must
refuse materialization while its original JSON remains unimported; requests must
not retry the upgrade. Replay this change on a stopped real-home copy before merge.

## Public text admission and lifecycle

Source ownership and presentation ownership are separate. A file provider can select
an installed `editing.text` webview through `textEditor`. The host resolves that
selection and issues an opaque placement-bound grant. A bare source reference is
local to the actual calling extension. It cannot nominate another publisher.
Authenticated client consumers resolve a file or provider under ordinary project
access and use the same grant/session service without impersonating an extension.

Initial admission validates complete source bytes and observed revisions before
binding a source. Ongoing operations re-run the owner's resolver to check access,
source identity and lifetime. They do not turn physical byte observations into a new
text authority. Full byte validation during these checks would race the host's own
background projection. The projection worker separately validates physical copies
and observed revisions in its serialized save path. This keeps typing and durable
acknowledgement independent of physical saves while preserving current access checks.

New public frames are validated in an isolated document before entering the durable
journal. Only plain source-text edits are accepted; host metadata, unrelated roots,
missing causal history and non-text content are rejected. Recovery history is itself
a mutation admission, even when no separate pending update is supplied, and requires
current write access. Exact duplicate submit/draft receipts can settle after write
permission is withdrawn. Their durable payload stays fixed while current editable
permission is overlaid; identity/lifetime and presentation checks still apply.

The SDK lazily loads its Yjs-backed session and owns its replica, batch queue and
captured durability fences. Yjs 13 is a normal external runtime dependency shared
with UI. Library code splitting does not install browser module-preload scaffolding;
otherwise rebundling SDK helpers would break the classic opaque-iframe bootstrap.
The runtime build parses its result as a classic script without executing it.

A draft retains its original causal history. Commit freezes the admitted delta and
retries that same delta until acknowledgement. Later mutations of a retained raw
Yjs recovery copy cannot alter the frozen submission. Retired-source failures retain
recovery data and fail waiting fences until explicit cancellation. A definitive
read-only refusal before admission also permits explicit cancellation, unless an
earlier attempt has unknown admission. In-flight requests cannot be cancelled.
A delivered durable acknowledgement settles the draft before member cleanup;
cleanup failure cannot reopen or replay that acknowledged draft. The lifecycle
retains failed cleanup membership until close or abandon succeeds. History adoption
rechecks edits authored during asynchronous opens before replacing a replica.

Members register before opening, so an in-flight open participates in normal close.
The host prepares every member, SDK finalizers commit or cancel local drafts, and
close waits for all authored edits, including frames queued behind a held ACK.
A failed member cancels the barrier and restores input for every member. Forced
revocation stops new admission and presence while draining already admitted work.
The workbench/native binding adoption of these primitives remains a delivery gate.

## Rich editor projection

The editor maps source positions through its Markdown serialization without
changing Lexical state. Temporary annotations belong only to the exported AST;
they never reach shared text, files or durable state. Position maps cover text,
decorators and empty blocks. Remote changes keep unaffected Lexical blocks and
restore selections through Yjs relative positions.

Commit pending local Lexical edits before merging remote history into the
rendering replica. Their diff belongs to the source the person still sees.
Commit remote reconciliation separately, so a later local edit cannot inherit
the remote update tag and skip publication. Composition keeps its own replica
until it finishes; a remote receive must not flush that transient draft.

Table editors retain their local drafts across changes to other cells. Capture
surviving source anchors for the table, rows and columns before a remote update.
Use those anchors to preserve the existing table view and its local IDs, including
after an earlier row or column is inserted. New rows and columns get fresh view
IDs. A deleted anchor resolving beside another row does not identify that row.
These IDs are projection state; Markdown remains the shared authority.

Opening a cell or header draft also captures its original source transaction.
Save applies only the draft's changes to that source history, preserving unseen
peer changes in the same cell. Encode literal pipes and line breaks for their GFM
cell context. Dispose the transaction on cancellation, target removal, read-only
transition or unmount. No-op composition cancellation refreshes table anchors.

IME preedit text stays in the rendering replica until composition commits. The
commit publishes its completed text together, then merges deferred remote changes.
Tentative text does not count as saved. Undo tracks local text operations and
preserves remote edits. Local undo, redo and composition commits notify the normal
editor change callback.

## Presence

The host assigns a participant handle per editor connection. Labels and device
names identify chips and carets. Selections use Yjs relative positions. Presence
is transient: never write it to a database, file, update journal or latest state.
Remove it on leave, connection close or lease expiry. Existing ticket limits are
4 KiB per update, 64-character labels, 32 joined rooms per connection, a 10-second
heartbeat and a 30-second lease. Reconnect republishes current live state.

Routine credential renewal preserves durable sync work and remote presence leases.
It starts a fresh live connection without failure backoff and republishes current
participants independently of durable sync completion. Crypto work admitted by the
old socket is cancelled. Real disconnects and denied renewal clear remote presence
and cancel the synchronization attempt.

## Alternatives rejected

- A Lexical Yjs tree creates a second authority and loses exact Markdown source.
- Raw-index cursors drift during concurrent edits.
- Per-extension providers or a public y-websocket server bypass shared host
  permissions and require extension authors to rebuild platform plumbing.
- Deterministic initial text authors do not solve differing offline baselines.
- Blindly merging unrelated seeds duplicates their original content.
- Five-minute checkpoints, local recovery files and PS-808 coverage belong to the
  replaced design. Normal durable documents implement PRD 0014 R6.

## Trade-offs

The rich editor must map source edits and selections in both directions, preserve
unaffected blocks, and defer remote reconstruction during IME composition. Keeping
the immutable genesis costs storage, but supplies the original character anchors
needed to preserve edits when independent offline histories meet. Local projection
baselines and network retries need clear ownership. Tests must cover first-join
races, edits during network waits, restart around atomic adoption, old-seed browser
messages and remote insertions inside local deletions.
