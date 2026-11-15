# What belongs in the database

The local database (PGlite, `PSTDIO_HOME/pstdio.db`) holds structured data and references. Bytes live in files. PGlite has no autovacuum, every startup opens the whole database, and every storage owner's work reads it, so anything large or unbounded there slows the whole app and is hard to reclaim. Rule [0006.2.15](../../guidance/0006-engineering.md#2-system-design) states the rule; this page explains how to apply it.

## Belongs in the database

| Data | Examples |
| --- | --- |
| Rows that are queried, joined, or indexed | projects, workspaces, sessions, settings, automation runs |
| Small current state and its revision | record values, cursors, receipt roots, sync positions |
| Ordering and identity facts that must commit atomically with other rows | operation ids, receipts, outbox entries, retry fingerprints |
| References to bytes | an asset's sha256 and byte length, a blob or node id, a file id |

## Does not belong in the database

| Data | Where it goes |
| --- | --- |
| File contents, attachments, images, archives | Asset store: `PSTDIO_HOME/storage/asset-bytes/` ([assets guide](../../guides/sdk/0002-assets.md)) |
| Transcripts and session logs | Session log files: `PSTDIO_HOME/storage/personal-history/` |
| Encrypted relay index nodes (receipt, log, and history indexes) | Index node files: `PSTDIO_HOME/storage/index-nodes/` ([below](#encrypted-index-nodes)) |
| Cached copies of relay or remote data | Files with an eviction rule, never rows |
| Document snapshots or exports | Files, written by the feature that needs them |

## Before adding a column, table, or document kind

1. Is any value larger than a few KiB, or does the number of values grow with use? Store the bytes in files and keep a reference.
2. Is it a cache? Write down how entries leave: a byte budget, reachability from saved roots, or the owner's deletion. A cache without an exit rule is a leak.
3. Is it history? Say what is kept and what removes the rest. Immutable and append-only data still needs a collector.
4. Who deletes it? Project deletion, extension data removal, and extension renames must reach the files too.
5. Measure it on a large real home with the pstdio-dev **Storage** page before shipping.

## Encrypted index nodes

The relay stores record receipts, append logs, and personal history as trees of immutable encrypted nodes. Each change writes new nodes and a new root; nodes only the old root reached stay behind. Each device keeps copies in `PSTDIO_HOME/storage/index-nodes/<project>/<extension>/<kind>/`, one file per node holding its validated edges and ciphertext.

| Kind | What it is | When nodes leave |
| --- | --- | --- |
| `receipts` | The full writer's durable copy of its receipt index. `replay()` re-uploads it after true relay loss, so writes are flushed to disk before a root naming them is saved. | When the owner first connects in a runtime, nodes that neither saved root (`storage_ordered_owners.receipt_root`: `root` and `published`) reaches through known edges are removed. |
| `logs` | A cache of relay index nodes for logs and personal history. Their roots live on the relay, and pending uploads keep their own bytes. | Least recently read nodes leave once the owner's cache exceeds 128 MiB. Nodes written in the last 10 minutes always stay. |

Collection follows the relay's rule ([blind relay](0029-blind-relay.md)): a node stays while a root needs it. Missing nodes and nodes whose edges are not yet validated end a traversal. Anything only reachable through them was downloaded and is still on the relay while a root needs it, so removing the local copy costs one download. A node this device wrote always records its edges before a root naming it is saved, so the device never removes its only copy of something a saved root needs.

Deleting a project removes its folder at the next startup. Removing an extension's data removes the owner's folder. An extension identity rename moves the folder when the database moved the owner's rows.

Until PS-1195 these nodes were base64 JSON inside `storage_documents` rows (`["ordered-index-blob", id]`) and nothing removed them; one Mac reached 6.6 GB of them. The first startup with PS-1195 moves the reachable receipt nodes into files, drops every node row, and runs `VACUUM FULL storage_documents`. A marker file in the index node folder finishes an interrupted compaction on the next start.

## Known exceptions

These columns still hold bytes. Each needs a move or a recorded size bound; new code must not add to the list.

| Column | Content | Status |
| --- | --- | --- |
| `storage_documents.state`, `storage_document_updates.update` | Yjs record and text document state | Bounded by the 256 KiB record limit and update folding; history is not compacted yet. |
| `native_document_rooms.state`, `native_document_room_updates.update`, `native_document_file_projections.baseline`, `.pending` | Native editor documents and file copies | Needs a size bound or file storage. |
| `recovery_point_owners.records`, `.metadata` | Gzipped recovery copies of records | Needs file storage. |
| `storage_log_entries.entry`, `.envelope`; `storage_record_outbox.frame`; `storage_ordered_records.state`; `storage_ordered_operations.envelope`, `.admission`; `storage_ordered_owners.receipt_root` | Sync frames, envelopes, and small ordered state | Small per row; measure growth before relying on that. |
