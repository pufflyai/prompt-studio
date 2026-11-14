# Frozen critical workload benchmarks

PS-233 authorizes a one-time consolidation into **exactly eight scenarios**. The executable owners are [suites.ts](../../../packages/benchmarks/src/suites.ts), [scenario manifest revision 1](../../../packages/benchmarks/src/catalog/scenarios.ts) and [catalog lock](../../../packages/benchmarks/catalog.lock.json). This candidate is **not qualified**. See the [disposition and qualification ledger](../../references/performance/0009-frozen-workload-ledger.md).

## Human authorization

After this consolidation, agents must not add, delete, replace, resize, reorder, relax or extend scenarios, metrics, fixtures, variants or platforms without an explicit human instruction identifying that change. Do not automatically add a benchmark for a feature. Ordinary product regression tests remain allowed. Never add tests of benchmark setup, instrumentation, selection or reports.

`bun run verify:benchmarks` checks the exact eight entry points, single case registration, metric allowlist and source digest. Executable workload/fixture/runner source is included in the digest, so grouping another loop or case under an existing ID changes the reviewed source. Formatting and comments do not change the TypeScript digest. A harness repair can keep the scenario version and fixture identity when semantics are unchanged.

A self-edited lock is not human authorization. Add the `benchmark` label to PRs that change benchmarks, workload definitions, fixtures, metrics, budgets or runners. Agents must leave these PRs for human review and merge, even when CI is green: do not merge directly, enable auto-merge or add them to the merge queue, and do not remove the label to bypass the rule. The PR records the human review and merge decision. There is no deployment approval or separate environment permission. See [PR labels](0004-pull-request-labels.md#benchmark-review-and-merge).

## Scenarios and hosts

| ID | Fixed workload | Owning hosts |
| --- | --- | --- |
| B1 | Empty-home first installed launch: window, authenticated API, default tools, usable workbench, first interaction | Linux x64, Apple Silicon Mac, Windows x64 |
| B2 | Fresh-process saved project: 100 messages, file, idle terminal | Linux x64, Apple Silicon Mac, Windows x64 |
| B3 | Same saved project, attach to an already-running owned runtime | Linux x64, Apple Silicon Mac, Windows x64 |
| B4 | Two populated projects; 30 turns × 8 updates × 25ms, one tool result per turn; foreground actions and cancel a second replay | Linux x64, Apple Silicon Mac, Windows x64 |
| B5 | Same saved fixture; 30s settle, forty fixed 15s action cycles; whole process tree sampled every 500ms | Linux x64, Apple Silicon Mac, Windows x64 |
| B6 | 1,000 Planner tickets, three edits each, one saved filtered list; cold actionable content, search, page, move, reopen | Linux x64, Apple Silicon Mac, Windows x64 |
| B7 | 10,000 deterministic records with three history edits; cold/warm page of 100, one edit, read during 100-record write/maintenance | Linux x64, Apple Silicon Mac, Windows x64 |
| B8 | One idle-session runtime crash; feedback, restored authenticated API/tools/content, first action, persisted data and cleanup | Linux x64, Apple Silicon Mac, Windows x64 |

Every B1–B8 scenario runs once on each of the three hosts in nightly and stable validation: **24 scenario/host combinations** per candidate. Intel Mac is excluded. The manual workflow and Performance run form default to all three hosts. Stable consumers keep signed release artifact identities; nightly Windows builds an unpublished production-mode desktop package and labels it source-diagnostic.

## Record before checking

Each scenario uses `runScenario` and emits one raw JSONL record for every declared metric, plus observations, host/CPU/RAM, source, workload version/fingerprint, cache, throttle, process ownership, sample and plan/execution identity. Missing, nonfinite, duplicate or unexpected measurements fail. Failed and incomplete first attempts remain evidence. Never substitute zero for a missing observation.

The result writer preserves raw values and maxima in format 2. Comparison requires matching workload identity, host class, cache, throttle, units and approved limits. A new workload starts a new explicitly authorized version; unlike workloads cannot be presented as an improvement. Never use a median-only budget gate or repeat an unchanged failing measurement to obtain a pass.

Metric classifications are product requirement, regression guard, supporting diagnostic, or **pending guard** awaiting a human limit decision. The user approved the aligned timing and native-memory limits below on 2026-11-14 and delegated B4's foreground limits. These supersede the former hardware-specific startup exceptions. Stronger journeys do not inherit unrelated old first-card/root-visible limits. Unqualified observations never become a successful production gate.

## Approved acceptance limits

Timing and average-memory targets use strict **<**, including equality as a failure, on all three platforms. GB means decimal bytes. Renderer share guards retain inclusive **≤**. The executable definitions are [catalog limits](../../../packages/benchmarks/src/catalog/limits.ts) and [shared phase limits](../../../packages/benchmarks/src/budget-limits.ts).

| Scenario | Targets |
| --- | --- |
| B1 | Window <1,200ms; shell <3,000ms; usable <5,000ms; first interaction <1,200ms |
| B2 | Usable <5,000ms; first interaction <250ms |
| B3 | Runtime attachment <1,800ms; usable <5,000ms; first interaction <250ms |
| B4 | Input/history/stream-to-paint <250ms; file <1,500ms; terminal <250ms; panel <500ms; project/session switch <2,000ms; longest stall <200ms; completion <10,000ms; cancellation <500ms |
| B5 | Average native memory <2GB on Linux/macOS, <3GB on Windows; complete ten-minute coverage, no missing samples, maximum gap ≤1,000ms |
| B6 | Timing, total scanned entries and write-amplification ceilings remain pending. Correctness requires bounded query pages and mounted rows ≤100, zero sequential projection scans, and persisted edits. |
| B7 | Cold read <300ms; warm read <180ms; one-record edit <120ms; read during maintenance <120ms. Correct data, zero sequential scans for indexed cold/warm pages, advancing index counters and exactly 101 writes remain required. |
| B8 | Recovery feedback <480ms; restored usable state <6,000ms; first action <300ms |

B4's chosen limits bound immediate foreground feedback, allow file/tool initialization separately, and keep the ten-second completion target above the fixed six-second replay schedule without extending that schedule. Retained renderer guards are idle script ≤2% and task ≤5%, streaming script ≤85% and task ≤120%. The last task-share guard alone does not constrain responsiveness; paint and stall targets do.


CPU profiling, Electron traces and forced-GC heap belong in separately labelled temporary investigations outside discovery and acceptance. CDP renderer script/task counters are supporting main-thread shares, not whole-app CPU or responsiveness proof. B4 also retains the mandatory two-second settle and ten-second idle renderer guard. Never dilute a share by increasing its idle window.

## Run and review

`bun run verify:benchmarks` is the fast PR/queue check. Measured scenarios run in dedicated nightly/release/source qualification; editing a benchmark must not add it to PS-232's ten-minute gate.

For a first-attempt local investigation, `BENCHMARK_BASELINE=1` permits capture without pretending that pending human limit decisions are resolved. Such results are explicitly unqualified and cannot certify a production consumer. Use the registered CLI's prepare and sample commands, select a supported B1–B8 ID, and retain all output. The [result reference](../../references/performance/0006-benchmark-results.md) describes identity and transport.

## Desktop benchmarks

B1 is first on every desktop host, with a new home and no owned runtime. Native first-launch OS checks remain part of the measured launch; do not clear quarantine or prewarm the app. The direct-executable macOS activation helper follows [temporary ADR 0150](../../adrs/0150-temporary-macos-native-test-activation.md); it does not establish signed-install or M5 portability by itself.

B2/B3/B4/B5/B8 share the same 100-message/file/idle-terminal fixture. Restore and check actual conversation contents, file text and usable controls. B3 verifies attachment to the same runtime PID/instance. B8 separates feedback from usable recovery and verifies old-process termination. Repeated crashes and terminal/error screens remain functional tests.

## Native memory sampling procedure

The [numeric targets](../../guidance/0003-nonfunctional-requirements.md) apply to the three requested platforms without an M5 hardware condition. B1 must become fully usable in <5 seconds, and B5 average native memory must remain <2GB on Linux/macOS or <3GB on Windows. Record actual CPU/cores/RAM and keep differing native memory semantics in separate series.

B5 workload version 2 uses `native-average`, `native-peak` and `resident-peak` metric IDs. It records physical footprint including compression on macOS, resident set bytes on Linux, and private committed bytes on Windows. These are separate platform series; they are not interchangeable physical-memory measurements. Older B5 physical-only results remain version 1 history.

B5 measures all owned desktop/runtime descendants, validates process generations, clips the time-weighted average to the measured interval and retains raw process readings. Missing native memory samples, incomplete cycles, sampling gaps over one second or an incomplete ten-minute window fail. RSS, JS heap and physical footprint including compression remain distinct. Do not force GC.

The user-approved timing and memory decisions do not turn earlier measurements into passing evidence. Preserve failed and unrun phases, incomplete samples and unresolved B6/scan/write guards in the ledger. Do not relax workloads or execution timeouts to meet a target.

## Keep a diagnostic only for unique evidence

Existing manual diagnostic tools may retain unique investigation evidence while their selected replacement is unqualified. They do not run in the frozen catalog or certify acceptance. Once a chosen scenario qualifies the same operation/data size/cache/correctness boundary, delete overlapping diagnostics, commands and documentation. Temporary profiling never becomes a new scheduled suite. The migration ledger records unresolved guards; similar names do not prove equivalent coverage.
