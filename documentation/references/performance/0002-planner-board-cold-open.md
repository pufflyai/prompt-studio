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
| 100 | 1.06 ms | 39 bytes |
| 20,000 | 0.60 ms | 44 bytes |

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
shown while loading. Its first page navigation opens Tickets and redeems a normal
single-use login link inside the timer. No dashboard page opens beforehand. The target
stays 2,000 ms for every sample.

The harness and loading fixes come from `bugfix/planner-cold-load`. The workbench
waits for saved views and field labels behind a board or list skeleton. Lists mount
only the rows near their viewport and keep focused or dragged rows mounted.
Progressive navigation reads keep their visible rows during a replacement read,
even when the earlier read has not finished loading every section.

The Planner cleanup change is delivered separately in [PR #1260](https://github.com/pufflyai/prompt-studio/pull/1260).
Use `--planner-source <directory>` to measure that extension with this runtime. The
option installs the selected source even when reusing a seeded `--home`. Interrupted
setup resumes from existing tickets and their generated edit contents. Measurement
always restarts the runtime and opens a fresh browser for every sample.

The earlier harness opened the dashboard to sign in, then timed a second navigation.
Those runs included a 2,722 ms failure and also misleading subsecond results. They do
not establish cold-open acceptance: the untimed page could start loading application
data. A first-navigation guard now prevents that setup.

With the corrected boundary, all ten samples initially failed: **2,180, 2,077, 2,162,
2,059, 2,069, 2,459, 2,435, 2,131, 2,096 and 2,155 ms**. Profiling found expensive
per-byte JavaScript conversion in PGlite's default binary type handlers. Reading the
23,103,286-byte saved document took 602 ms before Yjs decoding.

The database now uses native hex conversion through PGlite's type-handler options.
Binary values remain Uint8Arrays, and caller-supplied handlers still take precedence.
Diagnostic state reads dropped to 67–129 ms. After removing the temporary probes,
the final runtime measured **795, 1,639, 1,582, 1,421, 1,388, 1,623, 1,717,
1,549, 1,677 and 1,789 ms**.
Every sample was below the unchanged 2,000 ms budget, with no raw loading IDs.

The harness reports slow resource requests and browser long tasks for every sample,
and exits with failure if any sample exceeds the budget or shows raw loading IDs.
No workload or time limit was reduced or increased.
