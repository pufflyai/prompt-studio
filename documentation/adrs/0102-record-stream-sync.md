# Sync records through one encrypted stream per owner

Proposed: 2026-10-24

## Context

[ADR 0100](0100-one-document-per-resource.md) gave each extension record its own Yjs document,
so a save loads only the records it names. The relay transport still synced one relay document per
local document, with an in-memory copy of each. Record documents never reached the relay, so
records stopped syncing between devices.

Syncing each record as its own relay document does not scale. An owner can hold 100,000 records.
One relay document per record means one read per record on every catch-up, 100,000 cursors and
100,000 latest states. [PRD 0014](../requirements/platform/0014-local-first-sync.md) also needs a
save that writes several records to arrive whole (R4), which separate documents cannot promise.

Each device moved its records out of the owner document on its own. Two devices that hold the same
project therefore have unrelated Yjs histories for the same record. Merging them would duplicate
multi-line text. The owner chose on 2026-10-24 that the first device to sync uploads its records,
and the others adopt them while keeping their later edits.

## Decision

Each owner syncs its records through one encrypted relay document, the **record stream**. The relay
stays blind and unchanged: it stores ciphertext updates, latest states and blobs.

- **Updates.** One relay update is one local save. Its encrypted frame lists each changed record's
  Yjs update and the files those records point to. A save larger than one update travels as an
  encrypted blob that the update references, so it still arrives as one unit (R4).
- **Outbox.** A save writes its frame to `storage_record_outbox` in the save's transaction, only
  for owners that sync (`storage_record_sync` has a row). The stream uploads outbox entries in
  order and drops them when the relay accepts them.
- **Downloads.** A page of downloaded frames is applied in one SQL transaction: record documents,
  current-record rows, owner revision and the stream cursor change together. Reads never decode Yjs.
- **Latest states.** A latest state lists encrypted chunks of record states, stored as blobs. The
  first latest state (no base) **founds** the stream. Every later one is a compaction: a device
  builds it only when it has read every update and its outbox is empty, so it holds nothing an
  update did not already carry. A device that follows the updates loads only the founding state, or
  a latest state when the relay removed updates it still needed. A compaction is due when the
  updates after the latest state outgrow it (its encrypted summary holds its size), so a large owner
  is rewritten in proportion to its edits, not every 1 MiB.
- **Joining.** A device joins on its first sync. If the relay has no stream and the device has
  records, it founds the stream with them; the relay accepts only one founding state, so only one
  device founds it. A device without records waits until a stream exists.
  Otherwise it downloads the stream and adopts it: each shared record takes the synced history, and
  this device's changes since it first saved the record are reapplied as an edit (a three-way merge
  with local winning where both changed one value; without the first save, a deletion wins). A
  record whose history the stream already shares merges normally. Records only this device has are
  uploaded.
- **Migrations.** A save inside a data migration uses deterministic Yjs authors per record
  document again, so two devices that run the same migration write identical updates (R44).
- **Failures.** Network errors stop the pass, and the next pass retries it. Only data that cannot be
  decrypted or decoded is set aside, and a frame with any unreadable record is set aside whole.
- **Owner metadata** syncs under a new relay name. Relay copies from before ADR 0100 still hold
  records in the owner document; merging them back would let the record upgrade overwrite newer
  record documents.

Relay manifests (`blob-references-v1`) are not used. A latest state lists its chunk and file blobs
directly, which the protocol allows up to 100,000 blob IDs.

## Consequences

- Catch-up costs one read per page of updates, not one per record. A new device downloads a latest
  state in a few chunk reads.
- Building or loading a latest state holds the owner's record states in memory once.
- A device whose saves are still queued cannot compact; another device can.
- Key generations do not restart the stream: the relay document stays the same and devices keep
  every key they need to read older updates.
- A purged owner joins again and adopts the stream.
- Two devices that hold their own copies of a record the founding device lacks, and adopt at the same
  moment, both upload their copies. Multi-line text in that record can then appear twice. This needs
  two separate upgrades of the same project joining within one sync pass of each other.
- Devices on releases before this change cannot read the record stream.
- ADR 0100's notes that records do not sync and that migration authors are no longer needed are
  replaced by this decision.
