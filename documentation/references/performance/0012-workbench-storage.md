# Workbench startup and shared database indexes

Measured on 2026-11-26 with Bun 1.4.4 and PGlite 0.4.6 on an arm64 Mac. The experiments used disposable filesystem copies and a file-backed fixture. Timings are local component measurements.

## Dashboard readiness

The benchmark timed interactive database open through the first Home data read, with a project already selected. It called the Home extension's `readHome` and the database workspace service's `getDefault`. Each run opened a fresh copy of the same two-project fixture with 1,024 file-backed dependency markers, including 64 operations needing a receipt selection. Six pairs alternated which version ran first. The comparison is against the synchronous marker upgrade in `72cfa52f3`.

| Measurement | Synchronous cleanup | Deferred cleanup |
| --- | ---: | ---: |
| Database open through first Home data read, median | 418 ms | 192 ms |
| Warm Home read, median | 0.32 ms | 0.32 ms |
| Markers remaining at first read | 0 | 1,024 |
| Markers remaining after maintenance | 0 | 0 |

The interactive scheduler first checks for quiet after 60 seconds, then every five minutes. It can pause between transactions of 64 document rows and between file sweeps of 32 directories. A forced maintenance pass on the fixture took a median of 274 ms. Home reads queued during that pass had per-run p95s of 10–19 ms. A request arriving during a transaction can wait for that transaction. Offline opens finish cleanup synchronously.

Project extension activation, HTTP and browser rendering fall outside the Home timing. The database schema upgrade builds the room index once. These measurements cannot predict total dashboard first paint.

On a separate large copy, the marker job started with 538,976 markers and paused with 538,280 remaining. After it resumed, the database had zero markers, all 538,976 operation rows and all 1,895 needed receipt selections. The SQL and selector pass, including count probes, took 9.3 seconds. That rehearsal copied the selector files needed for migration. The smaller Home fixture exercised the complete file collection path. Physical disk reclamation from the SQL tables depends on later maintenance.

## Shared database indexes

| Experiment | Result | Decision |
| --- | --- | --- |
| Document room parent | One linked room among 609,196 documents. Index size fell from 5,079,040 to 16,384 bytes. Median lookup was 0.127 ms before and 0.094 ms after. Rebuilding took 118 ms. | Index only documents with a parent. The parent lookup returned the same row, and deleting its parent still cascaded in a rolled-back test. |
| Receipt sync with a backlog | Median time for a page of 100 receipts was 1.40 ms with the 48.7 MiB receipt index and 0.49 ms after dropping it. | Also test a nearly caught-up owner before removing the index. |
| Receipt sync nearly caught up | With 100 dirty operations spaced across 100,000, the indexed median was 0.31 ms. Dropping the index raised it to 6.16 ms. The p95 rose from 0.46 to 7.01 ms. | Keep the receipt index. Both variants returned the same page. |

The room and receipt lookup experiments each used 30 measured reads after two warmups. The production-copy retention check also found 294,561 compacted tombstones and zero eligible for purge under the existing retention rules.

## Extension query definitions

Extension manifests and the SDK register query fields, filters and ordering as owner metadata. Physical database indexes belong to the host. The core Resource Activity service uses a fixed host definition. Quiet maintenance also retires legacy physical indexes for extensions that are inactive.

On 2026-11-27, a Planner lookup used the `ticket-review-requests` collection definition to find one request by ticket ID among 5,000 requests in PGlite. Both paths ran the same query and produced the same IDs. The benchmark ran four passes in reverse order for the second pair, analyzed the records table before each pass and discarded four warmups per pass.

| Measurement | Per-project physical indexes | Query metadata |
| --- | ---: | ---: |
| Index bytes allocated for this declaration | 1,548,288 | 0 |
| Registration, two samples | 22.7–36.0 ms | 2.4–4.2 ms |
| Lookup median, 50 samples | 2.35 ms | 15.65 ms |
| Lookup p95 | 5.23 ms | 34.48 ms |

The additional lookup time applies to this selective query. Ticket-opening UI, large board aggregates and record write throughput were outside this measurement. Definitions with derived fields can still backfill values on registration.

On a copy with 337,379 records, all six generated indexes (240 KiB) belonged to core Resource Activity. Cleanup and host activation preserved their original database object IDs. This copy had zero extension index bytes to reclaim. After seeding two legacy extension declarations and physical indexes, a forced pause and restart retired both indexes. The record count, digest of saved definitions and host indexes matched before and after retirement.
