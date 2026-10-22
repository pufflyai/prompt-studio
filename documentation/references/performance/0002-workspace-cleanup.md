# Bulk workspace cleanup

Investigated: 2026-10-19. The reported workload was archiving 28 large tickets with linked workspaces on macOS, causing a CPU spike.

## Where the work comes from

Archiving a column saves the ticket records, starts linked-workspace cleanup in the background, and refreshes the board. Cleanup stops active sessions, removes each managed Git worktree and branch, archives its sessions, and deletes the workspace record. It is filesystem and database work, not just an archived flag.

The old path multiplied concurrency at three points:

1. Planner submitted every workspace deletion together. HTTP and other extension callers could add more work at the same time.
2. Each workspace submitted all of its session archive writes together. With 28 workspaces and 200 unarchived sessions each, up to 5,600 writes could be queued. Each write also passes through the service's sync publication path.
3. Board session badges loaded every page of every linked workspace's session history, although they show only one session. Long histories caused avoidable SQL work, object creation, and result transfer during refreshes.

Git cleanup checks the managed path, lists registered worktrees, resolves their paths, removes the tree with `git worktree remove --force`, and removes its branch. Deletion cost depends heavily on file count. Dependency directories with thousands of small files can be expensive even when their byte size is modest. Concurrent subprocesses and path checks compete for CPU and filesystem capacity. macOS indexing or security software can add work, but this investigation did not profile those processes.

Each cleanup resolves the registered worktree paths independently. Starting all 28 together can therefore submit roughly 28 times the registered worktree count in path checks before any tree disappears. Bounded admission also limits this internal filesystem fan-out; the managed-path safety checks remain intact.

The renderer already coalesces refresh events and allows only one running query plus a pending refresh per view. It does not start a separate board query for every session event. Reducing the work inside a refresh is still valuable, especially with multiple views.

## Implemented limits and ownership

- The host owns a FIFO queue with **two active workspace deletions** per workspace service. HTTP, CLI calls through HTTP, and extension deletions share it across projects and overlapping archive batches.
- A slot covers session cancellation, provider/Git cleanup, session archival, and workspace deletion. Duplicate requests for the same workspace share a promise. Success and failure both release the slot; a failed request can be retried.
- Session archive writes run sequentially within each workspace. Normal queued deletion therefore contributes at most two in-flight archive writes. This does not limit unrelated session operations elsewhere in the app.
- Planner badge lookups share **four active lookups** per loaded module. Each asks for the newest ongoing session with `limit: 1`, then the newest session with `limit: 1` if none is ongoing. Archived sessions remain eligible, preserving the existing badge behavior.
- Column archival still returns after saving the tickets. Cleanup failures retain the existing persistent notification, and workspaces linked to an active ticket remain protected.

Two deletion slots retain overlap between filesystem and database waits without starting a Git process for every workspace. A per-command limit would allow overlapping commands to multiply the work again. Moving promises to a worker thread would not reduce Git's CPU or filesystem work. Arbitrary sleeps would slow completion without removing the avoidable queries.

This is admission control, not an operating-system CPU quota. Two expensive jobs can still use CPU, and unrelated application work can overlap them. The queue does not wait for asynchronous extension event handlers or browser rendering. It is in memory and does not add durable restart recovery. Project cleanup, worktree-only removal, and provider reconciliation have separate entry paths; this queue covers normal workspace deletion requests.

## Measurements

The measurements use Bun 1.4.2 on Linux with a four-core CPU quota and 16 GiB memory. They are component benchmarks, not a macOS profile or an end-to-end archive latency claim. Fixture preparation is excluded. No performance budget or timeout was increased.

### Session badge queries

The benchmark uses the real PGlite schema and query service in an isolated in-memory database: 28 workspaces with 1,000 sessions each. Half have an ongoing session in the middle of their history; half need the latest completed session. Both strategies select the same session IDs. Results are medians of three runs with alternating strategy order.

| Strategy | Elapsed time | Process CPU time | Queries | Returned session records |
| --- | ---: | ---: | ---: | ---: |
| Full history, 28 concurrent lookups | 6,032 ms | 6,346 ms | 140 | 28,000 |
| Targeted queries, 4 concurrent lookups | 1,055 ms | 1,187 ms | 42 | 28 |

This fixture reduces measured CPU work by about **81%** and returned records by **99.9%**. A `limit: 1` result does not mean the database examines only one row; the measured query cost remains relevant. These results do not include extension bridge transfer, browser rendering, ticket body persistence, or Git cleanup.

### Git worktree cleanup

The benchmark creates 28 real Git worktrees, each with 5,000 untracked 1 KiB files under dependency-style directories: 140,000 files total. It calls the production cleanup function and compares concurrency 1, 2, 4, 8, and 28, rotating order across three runs. The filesystem is the workspace's overlay-backed storage, not `/tmp`, which is a RAM disk in this environment. Files are freshly written, so this is a warm-cache fixture, not a cold-storage test.

The final run had no competing builds or test suites. Values are medians of three runs; elapsed ranges show all three samples. CPU cores are each run's CPU time divided by elapsed time. Delay columns are the median of each run's p95 probe result.

| Parallel deletions | Elapsed ms (range) | CPU time ms | Average CPU cores | Event-loop delay p95 ms | Read latency p95 ms |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1,609 (1,590–2,486) | 1,651 | 1.04 | 0.9 | 2.4 |
| 2 | 917 (895–989) | 1,870 | 1.99 | 0.5 | 3.3 |
| 4 | 637 (564–667) | 2,347 | 3.74 | 2.6 | 3.4 |
| 8 | 583 (576–584) | 2,325 | 4.02 | 19.7 | 5.9 |
| 28 | 584 (574–602) | 2,328 | 4.00 | 143.6 | 48.0 |

Two jobs finish about **43% sooner than serial cleanup**, while using about half the CPU capacity consumed by four or more jobs. Four is faster but nearly fills the four-core quota. Eight saves only 54 ms over four in the median; 28 adds no throughput over eight and substantially delays the event-loop probe. Two is a conservative foreground-responsiveness choice, not the maximum-throughput setting.

The first serial sample was slower than the next two and remains included in the range. Short runs provide relatively few 50 ms probe samples; the delay values are diagnostic observations, not a new performance budget or a dashboard frame-rate guarantee.

## Reproduce

Run from the repository root after installing dependencies. These scripts create disposable fixtures; they never open the user's database or delete existing workspaces.

```sh
bun --conditions=source packages/pstdio-db/src/services/sessions/session-query.bench.ts

BENCH_ROOT=/path/on/the/workspace/filesystem \
  bun --conditions=source packages/pstdio-api/src/features/workspaces/worktree-cleanup.bench.ts
```

`BENCH_FILES`, `BENCH_REPEATS`, and comma-separated `BENCH_LIMITS` control the filesystem fixture. Defaults are 5,000, 3, and `1,2,4,8,28`. Each run uses an owned temporary directory inside `BENCH_ROOT` and removes it afterward. Allow space for the fixture, and run while other build/test work is idle.

Filesystem CPU measurements read the Linux cgroup and include all processes in that cgroup; they are `null` on macOS. CPU percentage uses 100% for one logical core. Short samples can exceed the average quota because quota enforcement uses longer windows. RSS includes the benchmark and sampled direct children on Linux, only the benchmark on macOS, and can miss short-lived processes. Event-loop delay and small-file read latency are responsiveness probes, not dashboard paint measurements.

For the reported macOS case, run the same filesystem workload on the same volume as actual workspaces, and capture the app, Git children, and system activity with Instruments or Activity Monitor. Test while normal foreground work is active. A two-slot default is supported by the Linux trade-off, but a claim of no macOS CPU spikes requires that local profile. Active-agent shutdown, very large ticket bodies, filesystem watchers, and indexing remain outside these fixtures.

## Regression coverage

Tests cover 28 mixed HTTP and extension requests sharing two slots through finalization; duplicate deletion; failed slots draining and retrying; sequential session archival before workspace deletion; immediate column archival with background cleanup and failure reporting; shared-workspace protection; correct ongoing/completed badge selection; and overlapping badge refreshes sharing the read limit.

The packaged smoke test uses a disposable remote provider to hold cleanup open, observes two active deletions from six HTTP requests, releases them, and checks that all six finish. It verifies the queue survives compilation and host wiring without relying on filesystem timing.

Targeted API and Planner tests, API/DB/Planner type checks, scoped Biome checks, and documentation link checks passed. Package verification built all platform binaries and passed published-type and package-consumer checks. Its CLI suite passed 92 tests. Six browser checks initially could not launch because the separate Playwright headless shell was absent; after installing that dependency, all six passed on rerun. The other seven browser checks passed on the initial run; four existing Firefox/WebKit cases were skipped by their environment conditions. The final host binary was rebuilt, its cleanup smoke passed again, and the remaining compiled-Bun smoke stage passed separately. The entire verification command was not repeated after fixing the browser dependency.

See [workspace lifecycle ownership](../architecture/0023-worktrees.md), the [host deletion queue](../../../packages/pstdio-api/src/features/workspaces/workspace-deletion.ts), and [Planner session lookups](../../../extensions/pstdio-planner/src/data/workspace-sessions.ts).
