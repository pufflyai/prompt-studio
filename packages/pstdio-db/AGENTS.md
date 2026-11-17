# pstdio-db

Read [What belongs in the database](../../documentation/references/architecture/0031-database-contents.md) before adding a table, a column, or a stored document kind.

- The database holds structured data and references only, never blobs ([0006.2.16](../../documentation/guidance/0006-engineering.md#2-system-design)). Bytes, caches of remote data, and snapshots go to files; keep only their ID, hash, and size here.
- Every cache and every retained history needs a rule that removes entries. Name it in the code that writes them.
- Encrypted index nodes live in `index-node-files.ts`. Do not store them in `storage_documents`.
- Index the columns of every foreign key that an `ON DELETE CASCADE` follows. Without one, each deleted parent row scans the child table.
- Rehearse startup and upgrade changes on a clone of a large real home, timing each step, before shipping them.
