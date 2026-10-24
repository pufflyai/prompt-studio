# Durable record query projections

Proposed: 2026-10-22

[ADR 0100](0100-one-document-per-resource.md) moves each record into its own document. The
owner-wide type-to-record mapping and the stale-projection rules below no longer apply. The
projection, its indexes and its query rules remain.

## Context

Extensions need selected pages, counts and point reads without loading an owner's
merge document. A read must not take the document lock, decode Yjs, reconstruct
all values or compute every record's content revision. PS-903 established that
whole-owner encoding and sync comparisons are also release blockers. A read
projection alone does not establish the PS-902 durable-edit or sync contract.

## Decision

The database owns a derived current-record projection. Its complete address is
the workbench, extension and existing record ID, including its scope namespace.
The authoritative data remains the existing CRDT document and durable updates.
No extension can write the projection independently.

Every document transaction observes changed shared types. The records and
tombstone directories identify inserted, removed and restored records. A durable
type-to-record mapping identifies edits to named children, which have no Yjs
parent link. A cached reverse mapping uses that persisted ownership after a
document load. New visible references extend the mapping for only affected
records. Hidden descendants cannot revive a tombstone. The mapping is derived
from document references and can be rebuilt with the projection.

Before committing, the same database transaction writes affected current records,
their content fingerprints, shared-type ownership, operation retry identities,
CRDT updates and the projection revision. Equal content does not replace its
current row. Notifications follow the database commit. A failed transaction
discards its mutated document cache.

Extensions declare typed fields and ordered indexes in `storageIndexes`. The host
installs them locally before publishing a loaded runtime. This cannot be hidden
inside the synced data-migration version: a second device may receive that version
without having installed its local indexes. `records.defineIndexes` provides the
same explicit installation boundary for host adapters and memory fixtures.
Registration populates the projection and creates deterministic database indexes.
Queries never register, rebuild or populate indexes. Re-registering unchanged
definitions against a projection at the current source revision does no rebuild.
An older writer can advance the source without updating derived rows. Reads and
incremental writes reject that stale projection until explicit index installation
rebuilds it atomically. A failed or interrupted rebuild preserves source data and
operation identities for retry. Full-scale upgrade and offline merge acceptance
remain PS-906 work.

SQL applies the owner, optional address prefix, predicates, stable order and
cursor before selecting fields and limiting the page to 100 records. The record
ID is the final sort key. Counts and groups run in SQL. Batch reads use complete
addresses and preserve input order. The memory SDK implements the same query
semantics; its test implementation may evaluate its in-memory document.

Storage owns the planner statistics for these queries. Each query index is
partial to its owner, and Postgres ignores partial-index statistics when it
estimates rows. Registration therefore also creates expression statistics for
each equality key. PGlite runs no autovacuum, so registration runs `ANALYZE`, and
the storage service runs it again after commits once projected row changes pass
50 rows plus 10% of the table. Without these statistics, a 100-value `in` list
looks like half the owner, and Postgres reads every row instead of the matching
index entries. An `in` list compiles to one array comparison per row, not one
comparison per value, so a full scan stays cheap when it is the right plan.

A cursor binds the owner, definition, predicate, selected fields and projection
revision. It carries the last sort values and record ID. A revision change rejects
the cursor; callers restart instead of combining inconsistent pages. Nulls sort
last in either direction. Missing and explicit null compare equal for equality
and grouping; `exists` and `missing` distinguish them. Array fields are string
arrays. Empty means missing, null, empty string or empty array. Typed queries
treat values of a different declared type as missing.

## Consequences and remaining acceptance

The projection and its indexes occupy extra disk space, but have one owner and
one atomic update boundary. An explicit rebuild can load a full owner; an
ordinary indexed read cannot. The legacy `list`, `read` and `commit` contracts
remain available. Legacy full lists retain their complete response.

This decision does not choose a new document boundary or claim that cold writes
pass. PS-905 owns the conditional boundary decision and bounded sync/checkpoint
work; PS-904 must integrate its transaction changes and PS-906 must preserve old
offline updates. The 100,000-row owner, both rich and small workloads, constrained
profiles and less-than-1,000-ms operations still require measured evidence. No
budget, workload or timeout is changed by this decision.
