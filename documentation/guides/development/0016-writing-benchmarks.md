# Write a benchmark

Benchmarks measure fixed product operations and report to the Performance pages. Use the shared runner and helpers so every benchmark is discovered, sampled and checked the same way.

## Name and register the file

Keep the benchmark beside the code it measures and name it `<behavior>.p3.bench.ts`. Add its exact repository path to one suite's `files` array in [suites.ts](../../../packages/benchmarks/src/suites.ts). That declaration supplies both the coverage check and the files a sample executes. Browser suites pass their declared files to Playwright; standalone suites execute their files with Bun.

Use `.diagnostic.ts` for investigations and stress reports. Diagnostics stay outside benchmark suites and the Performance pages. Existing fixed-workload benchmarks can contain repeated edits or navigation inside one workload; that does not turn their fixture into a diagnostic.

Run `bun run verify:benchmarks`. CI runs the same check on every PR. It rejects unregistered benchmark files, missing registered files, duplicate ownership, registered files their suite does not execute, and the former `.perf.ts` and `.stress.ts` names. A new suite also needs a matching option in the pstdio-dev Runs page; existing suites need no UI change.

## Keep a diagnostic only for unique evidence

A diagnostic stays only while no registered benchmark measures the same operation, data size, cold or warm state and correctness checks. When a benchmark covers all of them, delete the diagnostic, its launch scripts and Knip entries, and point its documentation at the benchmark. A similar name is not coverage.

PS-971 compared every diagnostic with the files in `suites.ts` on 2026-10-30. No benchmark covered any of them, so all stay:

| Diagnostic | Unique evidence | Closest benchmark and why it does not cover it |
| --- | --- | --- |
| `packages/e2e/src/perf/planner-moves.diagnostic.ts` | Board drag-and-drop paint, long tasks, CPU profiles, command and refresh timing, and saved order for 50–1,000 tickets with 1 or 15 views | `planner-board-cold-open.p3.bench.ts` (`planner`) times only the first card after a restart. No benchmark moves a card. |
| `extensions/pstdio-planner/src/commands/reorder-ticket.diagnostic.ts` | Storage writes, unchanged writes and stored bytes for one reorder at 50, 500 and 1,000 tickets, without a browser or database | No benchmark runs a reorder. `ticket-move-performance.p0.test.ts` checks the one-write rule with three tickets. |
| `packages/e2e/src/perf/planner-stress.diagnostic.ts` | Timeline first open, plan response bytes, mounted cards, filter switches and page heap with 1,000 tickets | `planner-board-cold-open.p3.bench.ts` uses the same seed data but opens the Tickets board, not the timeline. |
| `packages/e2e/src/perf/storage-scale.diagnostic.ts` with the sync and database `document-scale.diagnostic.ts` workers | PS-903 owners with 1,000–100,000 records, cold first writes, lists, atomic edits, folding, sync merges and container limits | `document-storage.p3.bench.ts` (`storage`) edits one record. `storage-bound.p3.bench.ts` (`relay`) measures relay storage, not client documents. |
| `packages/pstdio-db/src/services/extension-storage/record-read-scale.diagnostic.ts` | Cold and warm indexed reads, paging, reads during writes and folding, and scan counts at PS-903 sizes | No benchmark reads extension records. |
| `packages/pstdio-db/src/services/resource-number-scale.diagnostic.ts` | Cold number allocation, one-record upload and new-device download with 100,000 resource numbers | No benchmark allocates or syncs resource numbers. |

Run them with:

```sh
bun run --cwd packages/e2e src/perf/planner-moves.diagnostic.ts   # after bun run dev:playwright -- --desktop
bun run --cwd extensions/pstdio-planner src/commands/reorder-ticket.diagnostic.ts
bun run test:planner-stress -- --packaged
bun run --cwd packages/pstdio-db diagnose:resource-numbers -- prepare /absolute/new-dir
bun run --cwd packages/pstdio-db diagnose:resource-numbers -- sample /absolute/new-dir
```

[Planner ticket moves](../../references/performance/0001-planner-ticket-moves.md) describes the move diagnostics. [Storage scale diagnostic](../../references/performance/0005-storage-scale-diagnostic.md) gives the storage-scale and record-read commands.

## Record before checking

Use `pstdio-benchmarks/writer` and `pstdio-benchmarks`. A record needs a stable metric ID, label, unit and finite value. Record every measurement before asserting so failed samples keep evidence.

`findBudgetFailures` checks every raw reading. A value passes only when it is finite and **strictly below** its budget. Equality fails. Missing data and an empty measurement list fail. The failure names the measured value, unit, budget and strictly-below rule. This policy was approved for PS-924 on 2026-10-30; it tightens the older inclusive comparisons without increasing any number.

Do not gate on a median that hides a slow raw reading. The [result format](../../references/performance/0006-benchmark-results.md) uses one median per independent sample for chart statistics; that reduction does not replace raw budget checks.

Add limits in [budget-limits.ts](../../../packages/benchmarks/src/budget-limits.ts), where each entry keeps its value, unit, establishment date and evidence. Use the existing limit for a migrated operation. Some old limits have no recorded measurement date; their entries say so instead of inventing evidence. Change a budget or timeout only after the user approves that exact value. Keep fixture sizes, cold-start boundaries and platform coverage fixed.

For example, an existing operation can record and check a reading with its registered limit:

```ts
import { plannerBudget } from "pstdio-benchmarks";
import { findBudgetFailures } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";

const measurement = { metric: "cold-open", label: "Open Tickets", unit: "ms" as const,
  value: elapsedMs, budget: plannerBudget.value };
recordMeasurement(measurement);
const failures = findBudgetFailures([{ name: measurement.label, ...measurement }]);
if (failures.length) throw new Error(failures.join("\n"));
```

## Let the runner own sampling

Use `benchmarkSampleCount(existingDefault)` from `pstdio-benchmarks` when a standalone script repeats its scenario. Playwright configs use the same function for `repeatEach`. `BENCHMARK_SAMPLES` is the one override; do not add another per-family repeat variable or an internal outer loop. Keep repetitions that are part of a fixed workload, such as ten project-switch cycles, unchanged.

The runner's `--samples N` controls independent samples. It starts each child with `BENCHMARK_SAMPLES=1` and carries `BENCHMARK_SAMPLE_INDEX` for counterbalancing within a workload. A request for ten samples runs each benchmark once per sample, rather than multiplying by a standalone default. Standalone defaults stay unchanged. Use `benchmarkSampleIndex()` when the workload alternates strategy order across samples.

A direct invocation still records and checks the same operations:

```sh
BENCHMARK_SAMPLES=10 bun run --cwd packages/e2e perf:subnav
BENCHMARK_SAMPLES=3 bun run --cwd packages/ui perf:chat -- chat-rendering.p3.bench.ts
```

Choose committed CI runs for comparisons; local runs validate the harness but competing work can distort their measurements. Start a paired run through the Performance Runs page or the [Benchmarks workflow](../../../.github/workflows/benchmarks.yml). See the [runner commands and result schema](../../references/performance/0006-benchmark-results.md).

## Share browser helpers

Use `throttleChromiumCpu(page)` and `recordPageMemory(page, { metric, label })` from `pstdio-benchmarks`. CPU throttling defaults to 4x and accepts `CPU_THROTTLE`. Keep its CDP session until the workload ends or the page closes. The memory helper collects garbage, reads retained JavaScript heap, and always detaches its own CDP session. Missing heap data is omitted, never recorded as zero.

Measure input and readiness in the same browser clock. e2e's `perf-helpers.ts` provides its workbench interaction clock and domain setup; it delegates shared budget and memory work to the benchmark package. Keep setup outside the measured interval, report renderer/OS metrics with their actual meanings, and close the isolated fixture in cleanup.

## Desktop benchmarks

The [nonfunctional requirements](../../guidance/0003-nonfunctional-requirements.md) set mandatory targets, including a 2-second M5 cold start and 2 GB average memory. Regular performance coverage runs in nightly CI and stable-release validation. Agents **SHOULD** run relevant benchmarks locally when they expect significant performance impact from a change. The existing CI budgets below use hosted hardware and a visible-workbench milestone; dedicated M5, aggregate-download, and average-memory checks are not implemented yet.

Every benchmark, including these, also reports to the shared result format that the Benchmarks workflow and the Performance pages use. See [Benchmark results](../../references/performance/0006-benchmark-results.md).

Desktop limits and their evidence live in `packages/benchmarks/src/budget-limits.ts`. Run them against a packaged app:

```bash
bun run --cwd clients/desktop package
bun run --cwd clients/desktop test:benchmark
```

The release workflow runs them in a separate step before the functional packaged suite. One worker runs files in name order and tests in declaration order. Intel macOS runs only the benchmark tagged `@essential`, the cold start, so it measures the first launch of the freshly signed app, including macOS launch checks. Other platforms run the cold start after the recovery launch. Before benchmarks were separated, it ran after two other packaged launches there too, so their budgets do not cover first-launch checks. The functional packaged suite and package checks still run after a benchmark failure, and the job still fails. The Windows signing workflow runs the benchmarks the same way. Benchmarks run without Electron traces, because trace screenshots and DOM snapshots add renderer work. Use the traced functional suite or a separate profile to diagnose a failure.

Each benchmark attaches `benchmark-<name>.json` before checking its budgets. It records the scenario, workload, measured process, start and end events, every metric with its unit and budget, the source revision, the sidecar checksum, and the runner. A metric must be below its budget. A missing or non-finite measurement fails the benchmark. `test-results/packaged-benchmarks.json` collects the run.

| Benchmark | Measured interval | Budget |
| --- | --- | --- |
| Cold start (empty home) | Process spawn to visible workbench root; process spawn to visible startup window | 8 s cold start (10 s on Windows, 28 s on Intel macOS); startup window 1.5 s on macOS (10 s on Intel), 1 s on Linux and Windows |
| Sidecar crash recovery | Runtime kill to visible recovery heading | 500 ms |
| Idle workbench, monitoring off or on | Renderer CPU share over 10 s after a 2 s settle | See the renderer table below; Electron main below 10% of one core with monitoring on |
| Idle extension preview | Workbench and Lab renderer CPU share over 10 s after a 2 s settle | See the renderer table below |
| Long streaming replay | Renderer CPU share from submitting the replay to an already open session until the API reports completion and Step 30 is visible | See the renderer table below |

Renderer benchmarks took 10–17 seconds each on Apple Silicon, within the existing 30-second packaged test limit. Linux and Windows release runs have not been measured yet.

Renderer benchmarks read Chrome DevTools Protocol `Performance.getMetrics` deltas for each measured renderer and attach the raw counter deltas. `ScriptDuration` and `TaskDuration` are main-thread proxies. They are not OS CPU, GPU, or paint measurements. Each budget is the share of measured wall time the renderer may spend in scripts or tasks.

| Check | Window | Budget (script / task) | Apple Silicon baseline, 3 runs |
| --- | --- | --- | --- |
| Idle workbench, monitoring off | 10 s after a 2 s settle | 2% / 5% | ≤ 0.04% / ≤ 0.11% |
| Idle workbench, monitoring on | 10 s after a 2 s settle | 2% / 5% | ≤ 0.01% / ≤ 0.07% |
| Idle extension preview (workbench and Lab frame) | 10 s after a 2 s settle | 2% / 5% each | ≤ 0.05% / ≤ 0.15% |
| Long streaming replay | about 6 s, until the session completes | 85% / 120% | 28–38% / 51–68% |

The idle budgets catch a constant render or polling loop. On 2026-10-10 the release rehearsals measured the streaming replay at up to 69% script and 99% task time on Apple Silicon, Linux, and Windows runners. The user approved budgets about 20% above those values. A task budget above 100% no longer limits anything, so script time is the remaining streaming guard.

The monitoring-on idle benchmark loads the Performance Monitoring extension, which turns monitoring on, so the dashboard's slow-frame observer and frame counter run during the measurement. The monitoring-off benchmark launches without it. Monitoring itself runs in Electron main, which renderer metrics cannot see, so the monitoring-on benchmark also records the main process share from the snapshot. On Apple Silicon it measured 0.1–0.8% while idle with monitoring on.

`clients/desktop/src/e2e/packaged-performance-monitoring.p2.spec.ts` covers the monitoring feature without budgets. A reload test forces a 120 ms frame before and after reloading the workbench and requires both to reach the snapshot. An extension process test opens the fixture's Lab webview and requires a process that hosts only that extension, separate from the workbench process. It then pauses the extension from the Performance Monitoring extension's details and requires the snapshot to list it in `pausedExtensionIds` and no process to host its frames. A snapshot test reads the snapshot through the preload and through `pst performance` to prove that a person and an agent receive the same measurements, then checks that turning monitoring off stops the endpoint.

The fake agent replays the long conversation when a prompt contains `__fake_long_stream__`: 30 assistant turns, 8 text updates each at 25 ms intervals, and one tool result per turn.

The streaming benchmark opens an empty session before submitting that prompt. Its counter interval covers the full replay, including the last rendered turn. It does not wait for Step 1 to be visible: auto-follow can move that row out of view before an assertion sees it.

`packages/e2e/src/ui/performance-monitoring.p2.spec.ts` covers the Prompt Studio Performance Monitoring extension in a browser tab. It checks that the loaded extension's meter shows measurements without any setting, and that its details show the desktop-only CPU note and no switch. A browser tab cannot measure processes, so pausing is covered only by the desktop spec. This spec has no time budget.

## M5 and average-memory reference procedure

- Use a production desktop build with default extensions on a native Apple M5 Mac with 10 CPU cores and 32 GiB RAM. Record the source revision, artifact, macOS version, power mode, cache state, and OS first-launch checks.
- Measure 10 independent cold launches, each with an empty app home and no app-owned process or persistent runtime running. Time process launch to a visible, interactive workbench with the authenticated core API and default tools ready. Retain separate phase timings.
- Report every launch sample, median, p95, and maximum against the 2,000 ms target. Saved-project launches and warm attachment are separate scenarios. These are planned measurements, not retries that replace failed results.
- For memory, use one local project, default extensions, a completed 100-message conversation, one open file, and one idle terminal. After a 30-second settle, record 10 minutes of a fixed sequence of opening and closing the conversation, file, and panels.
- Sample at least once per second. Include every app-owned process: desktop main, renderers, GPU and utility helpers, local runtime, and extension hosts.
- Compute the time-weighted average as `sum(total process-tree memory × sample duration) / sum(sample durations)`. On macOS, use OS-attributed physical footprint including compressed memory; keep RSS and JavaScript heap separate.
- Retain raw samples, missing-sample information, process counts, startup and steady-state peaks, and memory after repeated open/close cycles. Do not replace missing readings with zero. Other platforms must identify their native memory metric.
