# Planner board cold open

Measured: 2026-10-20. PS-819 replaces journal replay with saved Yjs document state and a
bounded tail of updates. Extension saves and cold reads no longer replay every earlier
edit. The [storage reference](../architecture/0026-synchronization-contracts.md) describes
the persistence contract.

## Record-save measurement

Run from the repository root:

```sh
bun packages/pstdio-db/src/services/extension-storage/document-storage.bench.ts
```

The benchmark uses real PGlite storage. It saves one ticket repeatedly, then measures
100 additional saves after 100 earlier edits and after 20,000 earlier edits. Both
samples include normal folding of incremental updates. It does not prewarm a cold
startup measurement or reduce the workload.

On macOS arm64, this implementation measured:

| Earlier edits | Mean save | Largest remaining incremental update |
| ---: | ---: | ---: |
| 100 | 2.12 ms | 39 bytes |
| 20,000 | 0.86 ms | 44 bytes |

These are local observations, not new performance budgets. Save retry IDs are stored
in an indexed local table instead of the Yjs document. This keeps a fold from copying
every past operation ID.

## Tickets after a runtime restart

```sh
bun run --cwd packages/e2e perf:planner-board-cold-open
```

The browser measurement seeds 1,000 tickets with three edits each and a saved view
filtered by status and priority. It restarts the compiled runtime before each sample,
opens a new browser, and records the first visible card or row and any raw option IDs
shown while loading. The target stays 2,000 ms for every sample.

The harness and loading fixes come from `bugfix/planner-cold-load`. The workbench
waits for saved views and field labels behind a board or list skeleton. Lists mount
only the rows near their viewport and keep focused or dragged rows mounted.

The Planner cleanup change is delivered separately in [PR #1260](https://github.com/pufflyai/prompt-studio/pull/1260).
Use `--planner-source <directory>` to measure that extension with this runtime. The
option installs the selected source even when reusing a seeded `--home`. Interrupted
setup resumes from existing tickets and their generated edit contents. Measurement
always restarts the runtime and opens a fresh browser for every sample.

Local macOS arm64 measurements used the same 1,000-ticket fixture with all 3,000 edits:

| Runtime revision | First visible ticket, every sample | Raw loading IDs |
| --- | --- | --- |
| Before the latest main merge | 604, 636, 592 ms | None |
| After the latest main merge (`578cb8737`) | 715, **2,722**, 741 ms | None |
| Purge fix and timing diagnostics (`13b93e537`) | 549, 536, 547 ms | None |

The 2,722 ms sample exceeds the unchanged budget by 722 ms. Its cause is unresolved;
the later diagnostic run does not erase that failure or establish acceptance. During
the diagnostic run, Planner queries took 89–109 ms. The harness now reports slow
resource requests and browser long tasks for each sample, and exits with failure if
any sample exceeds the budget or shows raw loading IDs. No workload or time limit
was reduced or increased.
