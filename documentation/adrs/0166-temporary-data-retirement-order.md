# Temporary generated table retirement after data conversion

Proposed: 2026-11-22
Status: Proposed. The implementation and interruption qualification are pending.

The storage migration needs its new integer owner graph before it can convert released record data. It must retain the released stream, outbox and ordered-owner rows until that conversion finishes. This serves the storage ownership and recovery intent in RB7 and RB10.

## External limitation

The ideal migration runner exposes versioned application-data work between generated schema changes. The installed Drizzle ORM 0.45.3 PGlite migrator accepts journal-listed SQL only. Its PostgreSQL dialect executes that SQL and records the journal entry in one transaction; it has no application-data hook. Calling the converter before the ALTERs cannot use the new graph, and dropping its inputs in those ALTERs loses recovery data.

## Decision

Keep one generated migration entry. Extend the package generator to place only the three retired legacy-table DROP statements in a generated companion SQL file. The journal-listed file builds the new graph and rewires its foreign keys. Database admission restores the captured graph, converts legacy owners, and executes the companion statements together only after every input has been converted or durably exported.

The old ordered-owner table supplies its existing completion marker until retirement. Preserve its original rows while rewriting the child graph. For a new legacy owner, create that marker and its conversion cursor in the same transaction. A marker without a cursor already means conversion is complete; the terminal transaction removes the cursor after publishing the converted data. Keep this existing contract rather than adding a permanent initialization flag or a second runtime authority. The old table leaves before successful retirement finishes.

A failed recovery export or failed isolation transaction retains the input tables and reports a diagnostic while healthy owners open. A later open resumes from the retained tables, snapshots and conversion cursors. Cancellation does not retire inputs. The main journal row alone therefore does not establish completed data conversion; every application and maintenance entry point must finish admission before returning a database.

An owner whose preservation did not finish remains unavailable for that connection, including through its canonical extension alias. Admission derives this scope from its failure without adding a durable schema flag or requesting conversion during normal access. Reads and writes that depend on the failed scope must reject; Cloud removal remains unknown. Unrelated healthy owners remain usable. Identity renames exclude the failed project and extension family, so its retained cursor, marker and original input cannot split across extension IDs. Healthy projects can rename the same extension. Index files follow each renamed project, including a restart after the rows committed but before the files moved.

After all conversion attempts, admission removes only completed owners' released sync rows and outbox frames in bounded pages. Failed scopes retain their inputs. Before a completed historical owner renames, its terminal marker can also be staged at the canonical address when that target is absent or independently complete. The original marker stays until table retirement. This prevents another failed owner from keeping released tables alive and causing a healthy renamed owner to convert again on the next open. Candidate discovery excludes failed scopes, so their unchanged rows do not trigger a rename or space compaction on every retry.

Packaged extraction must include the companion. The fresh-image builder applies it after migrating its known-empty database. Runtime requests neither convert legacy records nor inspect the retired tables.

## Limitations

This is a temporary migration adapter, not the intended migration system. Companion SQL remains generated from schema changes; it is never handwritten. Original inputs and failed-owner exports retain their existing file durability rules. Windows directory fsync retains the limitation described by the database's existing recovery helper.

Future migrations must maintain or retire the versioned data conversion and snapshot-restoration contract before changing its graph. Qualification must cover released data, pending saves, native history, healthy and corrupt owners, failed exports, interrupted restoration and terminal cursor publication, oversized rows, actual CLI and packaged startup, and reopen. No final-schema or shipped-behavior claim follows from this proposed ADR.

## Removal

Replace the adapter when the migration runner supports generated schema phases with versioned data hooks. Alternatively, remove this baseline's converter, snapshots, completion marker and companion together when a later engine baseline explicitly retires this upgrade path with preserved recovery exports. Remove the generator exception and this ADR's active references at the same time.
