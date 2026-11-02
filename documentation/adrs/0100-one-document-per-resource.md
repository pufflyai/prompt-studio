# One document per resource

Proposed: 2026-10-23

Status: Accepted.

## Context

Extension records live in one Yjs document per extension owner (`document_id = "records"`).
Every write loads, locks and encodes that whole document, and its memory grows with every record
and edit. The PS-903 workload (100,000 records, four edits each) measured a 2.9 s first write
after restart and a 14.3 GB peak RSS, after the Yjs root-name fix. Reads were moved to the SQL
projection in [ADR 0099](0099-durable-record-query-projections.md), but writes still pay for the
whole owner.

An experiment stored each record in its own Yjs document in the same tables. On the same
workload the first write after restart loaded one checkpoint and three update tails (2.2 KB),
and peak RSS fell to 1.64 GB.

Keeping released 0.45 sync clients working would require keeping the owner-wide causal history
(an earlier proposal). The relay is not active yet, so that constraint does not apply.

## Decision

Each record is its own Yjs document. Its address is the owner plus
`document_id = JSON.stringify(["resource", recordId])` in `storage_documents` and
`storage_document_updates`. A record document holds only that record's value, shared edits,
asset and deletion state.

- **Group commits** keep their atomic contract. One SQL transaction locks the owner's
  `"records"` row, loads only the named record documents, applies the edits, appends their
  updates, publishes their projection rows, advances the owner revision and stores the operation
  receipt. A failure writes nothing.
- **The owner revision** stays on the owner's `"records"` row. It orders commits, binds query
  cursors and names the projection revision.
- **Compaction** folds a record's update tail into its checkpoint inside the write that reaches
  128 updates. The work is bounded by one record.
- **Reads** use the SQL projection only. No read decodes Yjs.
- **The owner `"records"` document** keeps owner metadata only: data migration versions, the
  text document directory, blob references and personal history maps. It no longer holds
  records.
- **Read-modify-write callers** (key-value collections, device automations) read through the
  records API and commit with expected revisions instead of holding the owner document.

**Upgrade.** When an owner still has records inside its owner document, storage moves them once,
before the owner's first record operation in each process. It writes each live and deleted
record into its own document with the current value, publishes the projection, and rewrites the
owner document with only its metadata. One SQL transaction covers the whole move, so an
interrupted move leaves the old owner document authoritative and the next start repeats it.
The move loads the old owner document once. Record edit history before the upgrade is not kept.

**Owner revision.** The owner's row in `storage_record_projections` holds the revision. Commits
lock it and advance it. Owner metadata writes do not change it, so they do not invalidate query
cursors.

## Consequences

- Write cost and memory depend on the records in the commit, not on owner size.
- Relay sync of records stops until per-resource sync exists. Accounts with Cloud early access
  keep their local data; their records do not sync. [ADR 0102](0102-record-stream-sync.md)
  restores record sync.
- Released 0.45 devices cannot merge with upgraded data. This is accepted while the relay is
  inactive.
- Deterministic migration authors are no longer needed for records, because no other device
  merges the same record history. ADR 0102 brings them back once records sync again.
- Owner-wide record type ownership (`storage_record_types`) and owner-document projection
  tracking are removed.
- The in-memory SDK storage keeps its single document. Conformance tests keep both
  implementations' public behaviour equal.
- The project resource-number document still grows with every numbered resource. It is a
  separate follow-up.
