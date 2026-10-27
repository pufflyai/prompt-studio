# Host-owned shared Markdown documents with transient presence

Proposed: 2026-10-17

## Status

Proposed implementation for PS-776. This moves its original ticket attachment into
the repository and updates the replaced checkpoint design to PRD 0014.

## Decision

Each editable native Markdown file view has a standalone document containing one
`Y.Text` of the text returned by its extension's load handler. Markdown is the
authority; a Lexical tree is only its editable view. The document key covers the
renderer, full resource identity, metadata and page parameters. Key ordering does
not depend on the device's locale. The host never accepts a source path from the
browser or derives one from a resource ID.

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

## Open source ownership decision

The callback-only file projection is not ready to ship. Review reproduced two
failures: a downloaded artifact is applied as another outside edit, duplicating a
peer insertion; and an outside deletion after a completed file write is undone
when a later save-handler step fails. Text equality, hashes and state vectors do
not identify the source history of a particular file version.

The proposed correction is an explicit source binding owned by core. It names a
stable logical source: a record field, or an artifact file with its body
projection. Views of the same source share one standalone text authority. Notes
needs its existing frontmatter/body parsing; Planner body binds its content field;
a Planner file uses ticket and file identity rather than the replaceable blob ID.
Extensions still contain no sync, merge or encryption code. Existing load/save
handlers retain presentation and business behavior.

Bind a replaceable current source witness atomically to the exact source payload.
An artifact asset and its witness can occupy one atomic map value. A record field
needs internal bound-text storage with ordinary string reads; a sibling stamp
cannot describe a separately merged record-local text. Ordinary edits to a bound
source must enter the standalone text authority before acknowledgement. A native
projection is a cache write, not a new independent text edit.

Transition must retain the actual existing source checkpoint and its known
baseline under the source lock. Preserve pre-binding offline edits and bridge
their original operation identities once. Where no causal baseline is available,
preserve the original and surface the ambiguity. Do not call potentially edited
local bytes unchanged genesis. Keep per-write provenance separate from completion
of the entire save handler. An ambiguous raw-file crash state must be preserved
rather than guessed.

This changes the unconditional promise of automatic collaboration for opaque file
callbacks. Such callbacks remain supported, but the proposed contract enables live
collaboration only after a source binding is declared. PS-776 decision request
`6c4e517f-f95e-4603-9983-8471fdaeb0c7` records this choice. The reviewed design
assessment and the two failing semantic probes are retained in RP-45. This section
records a proposal; it does not claim the binding or transition is implemented.

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

## Rich editor projection

The editor maps source positions through its Markdown serialization without
changing Lexical state. Temporary annotations belong only to the exported AST;
they never reach shared text, files or durable state. Position maps cover text,
decorators and empty blocks. Remote changes keep unaffected Lexical blocks and
restore selections through Yjs relative positions.

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
