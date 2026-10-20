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
| 100 | 0.98 ms | 39 bytes |
| 20,000 | 0.67 ms | 44 bytes |

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

Results for this revision are being collected with 1,000 tickets and three edits each;
earlier branch results do not prove this revision meets the browser target.
