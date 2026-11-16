# Keep caches and blobs out of the database

## 1. When to use

- Adding storage for bytes, caches of remote data, or immutable history.

## 2. Failure

- PS-1016 cached every encrypted relay index node as a base64 JSON row in `storage_documents`. Nodes are immutable; each change wrote new ones and nothing removed the old.
- Personal history rebuilds its index on every snapshot, so one Mac reached 6.6 GB of node rows, larger than the 5.3 GB of transcripts they indexed. The database grew to 12.6 GB, 9.2 GB of it out-of-line values.
- PGlite never vacuums on its own, and every owner open, startup, and project setup works against the whole database. Opening the Prompt Studio project went from 7 s to 84–356 s over the same days.

## 3. Prevention

- Follow [What belongs in the database](../references/architecture/0031-database-contents.md) and rule [0006.2.16](../guidance/0006-engineering.md#2-system-design): bytes go to files, the database keeps references.
- Give every cache and history an exit rule (byte budget, reachability, or owner deletion) in the same change that adds it.
- Check database and storage size on a large real home with the pstdio-dev **Storage** page before shipping storage changes.
- Rehearse startup changes on a clone of a large real home (`cp -c -R` on APFS clones instantly) and time each step.

## 4. Evidence

- PS-1195 moved index nodes to files beside the database (`PSTDIO_HOME/pstdio.db-index-nodes/`) with reachability collection for receipts and a bounded cache for logs. The first start on that Mac took 87 s and shrank the database from 12 GB to 2.1 GB.
- The same rehearsal found extension renames spending 271 s in one `DELETE`: `storage_ordered_receipts` had no index on the foreign key it shares with `storage_ordered_operations`, so each deleted operation scanned the owner's receipts. Index every foreign key a cascade follows.
- [Index node files](../../packages/pstdio-db/src/services/extension-storage/index-node-files.ts)
