# Workbench startup, Reports lookups and index size

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

Project extension activation, HTTP and browser rendering fall outside the Home timing. The Reports index build below can delay first project activation. The database schema upgrade also builds the room index once. These measurements cannot predict total dashboard first paint.

On a separate large copy, the marker job started with 538,976 markers and paused with 538,280 remaining. After it resumed, the database had zero markers, all 538,976 operation rows and all 1,895 needed receipt selections. The SQL and selector pass, including count probes, took 9.3 seconds. That rehearsal copied the selector files needed for migration. The smaller Home fixture exercised the complete file collection path. Physical disk reclamation from the SQL tables depends on later maintenance.

## Reports

The copied database contained 337,379 records across owners. One project had 892 live Reports. The old command listed the collection and filtered in JavaScript. Saving without a name listed twice when the workspace had one report. The candidate requests just the ID and name, bounded to two matches, and preserves historical ordering for duplicate names. Saving and deleting still re-read the chosen report under the write lock. The benchmark stops at report selection.

| Report selection | Previous median | Indexed median | Previous p95 | Indexed p95 |
| --- | ---: | ---: | ---: | ---: |
| Workspace and name | 57.24 ms | 2.74 ms | 64.42 ms | 3.94 ms |
| Only report in the workspace | 115.58 ms | 2.29 ms | 136.34 ms | 4.49 ms |

These results use the runtime index installer before its first scheduled statistics refresh. The benchmark rotated through a pool of 93 single-report workspaces, alternated execution order, discarded two warmups and compared the returned IDs for 25 measured samples per path. A separate run with refreshed statistics measured 57.61 to 2.60 ms for named lookup and 122.63 to 2.54 ms for unnamed lookup.

Installing the index for this owner during project activation took 796 ms. Repeating the same registration took 2.08 and 1.75 ms. The two physical indexes for this declaration occupied 336 KiB together. The build cost scales with the shared records table and can affect the first dashboard visit to an upgraded project with Reports enabled.

## Index and store decisions

| Experiment | Result | Decision |
| --- | --- | --- |
| Document room parent | One linked room among 609,196 documents. Index size fell from 5,079,040 to 16,384 bytes. Median lookup was 0.127 ms before and 0.094 ms after. Rebuilding took 118 ms. | Index only documents with a parent. The parent lookup returned the same row, and deleting its parent still cascaded in a rolled-back test. |
| Receipt sync with a backlog | Median time for a page of 100 receipts was 1.40 ms with the 48.7 MiB receipt index and 0.49 ms after dropping it. | Also test a nearly caught-up owner before removing the index. |
| Receipt sync nearly caught up | With 100 dirty operations spaced across 100,000, the indexed median was 0.31 ms. Dropping the index raised it to 6.16 ms. The p95 rose from 0.46 to 7.01 ms. | Keep the receipt index. Both variants returned the same page. |
| Separate Reports SQLite cache | Reading 892 live reports from the shared store and populating an indexed cache took 63 ms and 112 KiB. Direct, in-process named reads had a 0.004 ms median across 100 samples. | Keep the shared store with the Reports-owned index. The cache prototype measures read speed only. Maintaining it across edits, sync, restarts and recovery would add work that this timing excludes. |

The room and receipt lookup experiments each used 30 measured reads after two warmups. The SQLite prototype contains only the report ID, workspace and name. It does not measure moving an extension's complete data or journal into its own database. The production-copy retention check also found 294,561 compacted tombstones and zero eligible for purge under the existing retention rules.
