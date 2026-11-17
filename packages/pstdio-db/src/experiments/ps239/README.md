# PS-239 diagnostic prototype

Run from the repository root. Prepare dependencies before timing:

```sh
bun install --frozen-lockfile
bunx lerna run build --scope @pstdio/sdk --include-dependencies
bunx lerna run build --scope @pstdio/ui --include-dependencies
bun scripts/experiments/ps239.ts --out /absolute/path/to/report/files/final
```

Use the `filesPath` returned by `pst pstdio.pstdio-reports reports write --kind change_request --name ps239_prototype_findings --template change-request`, with a fresh child directory. The runner executes sequentially, stops on a failure, retains raw samples and SQL plans, and writes exact source hashes and a summary. It opens only disposable in-memory PGlite databases and closes them; it starts no server and changes no installed extensions. Keep captures outside committed source. Delete only your output directory when evidence is no longer needed.

| Experiment | Implemented probe | Important boundary |
| --- | --- | --- |
| E1 | Real storage list versus a 100-record projection query plus authoritative aggregates | Storage read and serialization only; no renderer or HTTP action clock |
| E2 | Actual SDK scoped-query owner versus experimental 25 ms fixed-window owner, with shared consumers and generation fences | Synthetic 2 ms provider and event stream; reports freshness delay as well as read count |
| E3 | Real Planner Timeline build/property mapping with explicit display/filter/sort/group/action dependencies | Does not qualify relationship resolvers or automatic dependency extraction |
| E4 | Actual host renderer registry with held admission and secondary reads | Establishes independence already exists; does not claim a new editor implementation or latency gain |
| E5 | Existing JSONB, equally indexed compact JSONB, and typed byte-key sidecars | Equal selected fields/IDs/counts; ASCII fixture only; SQL read adapter is not the application query API |

E1/E5 run at 100, 1,000 and 5,000 tickets, keeping 5,000 Foobars constant. Fixtures have variable synthetic bodies, three metadata-history commits and equal-position tie cases. Every representation gets populated statistics. E5 reads are warm after parity checks, with matching response shapes, selection/order indexes and separate EXPLAIN captures. Both sidecars contain only selected query metadata; neither copies canonical revision history. Sidecar triggers run in the canonical transaction, verify rollback, and skip tuple rewrites for body-only changes. Write timings measure **additional sidecar cost on top of current JSONB maintenance**, not replacing the current projection. E1 counts returned records, not internal materialization or database scan work; use the query plans for the latter.

This is a first-pass executable prototype, not PS-239 completion or production qualification. It does not run the historical PS-236 fixture, production browser workflows, B/V1–V5 integration, disk/restart durability, received updates, rich relationship providers, full scalar/string conformance, bulk archive cleanup or true device sync. Memory snapshots are process RSS observations, not whole-app memory benchmarks. E1 payload sizes are serialized storage results, not HTTP response sizes. The fixture's `:memory:` commits do not prove disk durability. No public API, migration or visual interaction changes; Canvas is therefore unnecessary under the ticket's existing policy explanation.
