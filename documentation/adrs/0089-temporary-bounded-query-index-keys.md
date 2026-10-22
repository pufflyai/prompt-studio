# Temporary bounded query index keys

Proposed: 2026-10-22

## Intended design

Extensions can select and compare stored strings without limiting record size.
Declaring a query index must not make an otherwise valid record impossible to save.
The durable projection retains the complete value.

## External limitation

PostgreSQL B-tree entries have a size limit. Indexing a full, incompressible
16 KiB string fails during a durable save. A normal B-tree cannot order arbitrary
length strings while guaranteeing bounded index entries.

## Decision

Keep selectable fields separate from explicit equality and ordering keys.
Use fixed-size digests for equality keys and always recheck the complete value.
Use bounded string prefixes for ordering keys and compare complete values in SQL
within equal-prefix groups. This temporary workaround belongs only in the SQL
query compiler; public values and cursor comparisons retain their full values.

## Limitations

Digest collisions cannot change query results because equality rechecks full values.
Large groups with the same string prefix can require sorting or scanning many rows.
This does not prove bounded access for arbitrary long-string workloads. Benchmark
the actual declared indexes and workload before claiming a performance budget.

## Removal

Replace prefix ordering with an ordered chunk index if measured workloads require
bounded access within large equal-prefix groups. Remove this workaround once the
storage backend can index complete arbitrary-length keys with that guarantee.
