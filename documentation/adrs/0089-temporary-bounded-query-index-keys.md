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

Named Yjs types can also contain complete nested JSON values. Their ownership
table keeps the original type name as text and uses a non-unique B-tree expression
index on the owner and `md5(type_name)` to find candidates. Insertion checks the
complete name, so digest collisions remain distinct. The existing authoritative
document row lock serializes these set insertions. No digest becomes a CRDT ID.
This replaces the full-name primary key, whose entry limit rejected valid nested
records and their backfill. It adds no stored hash or surrogate product identity.

## Limitations

Digest collisions cannot change query results because equality rechecks full values.
Large groups with the same string prefix can require sorting or scanning many rows.
This does not prove bounded access for arbitrary long-string workloads. Benchmark
the actual declared indexes and workload before claiming a performance budget.

## Removal

Replace prefix ordering with an ordered chunk index if measured workloads require
bounded access within large equal-prefix groups. Remove this workaround once the
storage backend can index complete arbitrary-length keys with that guarantee.
Remove the ownership expression index when full type names can be indexed
without an entry-size limit; retain exact-name equality during any transition.
