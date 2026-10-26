# Relay storage bound

Measured: 2026-10-20. PRD 0014 R23 says relay storage for a document stays below twice its latest state, plus the grace-period copy. This benchmark checks the relay's part of that rule after 10,000 updates. Clients decide when to upload a new latest state (PS-822); the benchmark uses the PRD's trigger of 1,000 updates.

## Run it

```sh
bun run --cwd services/relay bench:storage-bound
```

It needs Docker. It starts throwaway PostgreSQL and RustFS containers on loopback ports, runs the workload against the real blind document store, prints a table and a JSON summary, and removes the containers. It is a manual benchmark and does not run in CI. CI runs the same check in `services/relay/src/storage/sync-bound.p1.integration.ts` with ten cycles of ten updates, which fits the default test allowance.

## Workload

- One document receives 10,000 updates of 120 encrypted bytes.
- After every 1,000 updates a client uploads a new latest state built on the current one, then cleanup runs.
- The latest state holds every edit's bytes (120 bytes per update), so it never shrinks. This is the worst case for the bound.
- Default limits, including the seven-day grace period. The grace-period copy is the replaced state and the updates after it.

## Result

Apple Silicon, Docker Desktop, Bun 1.4.2. Bytes are object storage totals after cleanup.

| Updates | Latest state | Grace-period copy | Stored | Limit (2 × latest + copy) |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 120,000 | 120,000 | 240,000 | 360,000 |
| 5,000 | 600,000 | 600,000 | 1,200,000 | 1,800,000 |
| 10,000 | 1,200,000 | 1,200,000 | 2,400,000 | 3,600,000 |

Stored bytes equal the latest state plus the grace-period copy after every cycle, two thirds of the limit. The run took 96 seconds; most of it is one object storage write per update. A run on 2026-10-19 took 102 to 224 seconds on the same machine, depending on load.
