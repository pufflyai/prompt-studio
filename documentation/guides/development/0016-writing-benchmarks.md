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

Metric classifications are product requirement, retained regression guard, supporting diagnostic, or **pending guard** awaiting exact-workload baseline and a human limit decision. Matching startup/recovery and renderer idle/stream guards retain their original values in [budget-limits.ts](../../../packages/benchmarks/src/budget-limits.ts). Stronger journey boundaries do not inherit an old first-card/root-visible limit. The old chat 20s/10s limits are not an approval of the new UX. Unqualified observations never become a successful production gate.

CPU profiling, Electron traces and forced-GC heap belong in separately labelled temporary investigations outside discovery and acceptance. CDP renderer script/task counters are supporting main-thread shares, not whole-app CPU or responsiveness proof. B4 also retains the mandatory two-second settle and ten-second idle renderer guard. Never dilute a share by increasing its idle window.

## Run and review

`bun run verify:benchmarks` is the fast PR/queue check. Measured scenarios run in dedicated nightly/release/source qualification; editing a benchmark must not add it to PS-232's ten-minute gate.

For a first-attempt local investigation, `BENCHMARK_BASELINE=1` permits capture without pretending that pending human limit decisions are resolved. Such results are explicitly unqualified and cannot certify a production consumer. Use the registered CLI's prepare and sample commands, select a supported B1–B8 ID, and retain all output. The [result reference](../../references/performance/0006-benchmark-results.md) describes identity and transport.

## Desktop benchmarks

B1 is first on every desktop host, with a new home and no owned runtime. Native first-launch OS checks remain part of the measured launch; do not clear quarantine or prewarm the app. The direct-executable macOS activation helper follows [temporary ADR 0150](../../adrs/0150-temporary-macos-native-test-activation.md); it does not establish signed-install or M5 portability by itself.

B2/B3/B4/B5/B8 share the same 100-message/file/idle-terminal fixture. Restore and check actual conversation contents, file text and usable controls. B3 verifies attachment to the same runtime PID/instance. B8 separates feedback from usable recovery and verifies old-process termination. Repeated crashes and terminal/error screens remain functional tests.

## M5 and average-memory reference procedure

The [numeric targets](../../guidance/0003-nonfunctional-requirements.md) are unchanged: **2 seconds** empty-home launch through interactive workbench/API/default tools on the M5 reference configuration; and **2 GB decimal** average physical footprint over the specified ten-minute workload. Per the user's instruction, a separate 10-core/32 GiB M5 proof run is optional and is not a benchmark-suite or release qualification prerequisite. Use the applicable CI hosts, record their actual CPU/cores/RAM and keep unlike host measurements separate. Other hardware does not certify the M5-specific target.

B5 workload version 2 uses `native-average`, `native-peak` and `resident-peak` metric IDs. It records physical footprint including compression on macOS, resident set bytes on Linux, and private committed bytes on Windows. These are separate platform series; they are not interchangeable physical-memory measurements. The existing 2 GB physical-footprint guard applies on macOS. Linux/Windows native-average limits remain pending explicit human decisions. Older B5 physical-only results remain version 1 history.

B5 measures all owned desktop/runtime descendants, validates process generations, clips the time-weighted average to the measured interval and retains raw process readings. Missing native memory samples, incomplete cycles, sampling gaps over one second or an incomplete ten-minute window fail. RSS, JS heap and physical footprint including compression remain distinct. Do not force GC. Available hardware, including a 16 GiB M5 or hosted Apple Silicon, is not disqualified solely for differing from the reference configuration.

B1's default-tool/actionable boundary and all new latency guards require representative actual-host measurements before qualification. Unrun phases and unresolved legacy guards stay visible in the ledger. The absence of a 32 GiB M5 run is not a blocker. No new numeric UX limits have been approved by this implementation.

## Keep a diagnostic only for unique evidence

Existing manual diagnostic tools may retain unique investigation evidence while their selected replacement is unqualified. They do not run in the frozen catalog or certify acceptance. Once a chosen scenario qualifies the same operation/data size/cache/correctness boundary, delete overlapping diagnostics, commands and documentation. Temporary profiling never becomes a new scheduled suite. The migration ledger records unresolved guards; similar names do not prove equivalent coverage.
