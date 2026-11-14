# Benchmark results

The permanent catalog is [B1–B8](../../../packages/benchmarks/src/catalog/scenarios.ts), revision 1. See [workload guidance](../../guides/development/0016-writing-benchmarks.md) and the [migration ledger](0009-frozen-workload-ledger.md). The previous nine families and their historical results are retired history; they are not comparable with this series.

## Execution and ownership

[suites.ts](../../../packages/benchmarks/src/suites.ts) maps each scenario to one program on Linux x64, Apple Silicon Mac and Windows x64. All eight run on all three hosts in nightly and stable validation; Intel Mac is excluded. The [Benchmarks workflow](../../../.github/workflows/benchmarks.yml) can collect one first attempt per selected commit/scenario/platform. Nightly and stable release validation use the same registered programs; desktop release consumers retain actual signed artifacts. Source-built comparisons cannot certify published artifacts.

PR and queue run only catalog verification. Editing a benchmark does not schedule its measurements in the ten-minute gate. Temporary profiling stays outside discovery and these workflows. CI never repeats a scenario to obtain a passing result.

## Raw evidence

`test-results/production-performance/B1.jsonl` through `B8.jsonl` contain started, observation, metric and finished/failed records. Each has source SHA, catalog digest/revision, scenario version and fixture fingerprint, actual platform/CPU/cores/RAM and B5 native-memory meaning, cache and throttle, sample and plan/run/execution identity. Artifact hashes and owned process details are observations. The manifest declares exact metric IDs and units.

A consumer checks identity again after transport. Missing, duplicate, extra, nonfinite, stale, dirty-source or incomplete measurements fail. Unresolved limits cannot read as green. Qualification does not require a separate 10-core/32 GiB M5 run; actual host identity remains mandatory. Raw budget outcomes are retained before failure. A baseline capture is labelled unqualified even if all observed values happen to be low.

## Aggregate result format 2

The comparison runner also writes `<sha>-<platform>.json`, with `format: 2`, commit, platform, runner, start/end times, suite metadata and metrics. Each metric includes `suite`, `metric`, `label`, `unit`, optional approved `budget`, `identity`, every raw `values` observation and `maximum`. There is exactly one observation for a metric per sample; duplicate observations are an error. No within-sample median reduction is performed.

Units are `ms`, `bytes`, `share`, `percent` and `count`. Missing measurements never become zero. B5 version 2 records native memory average/peak, resident peak and JS heap separately. Native memory means macOS physical footprint, Linux resident set or Windows private committed bytes, identified by `memoryMetric`; their numeric values are not interchangeable. The user-approved strict native-average limits are <2GB on Linux/macOS and <3GB on Windows. Version 1 physical-only B5 results remain history. Lower values alone do not establish correctness or responsiveness.

Comparisons require equal scenario/workload version and fixture fingerprint, catalog digest, platform/host class, RAM/cores, cache, throttle, units and approved limit. Product code changes may share a workload series; semantic workload changes start a newly authorized version. Old format-1 results remain historical and must not be silently compared to format 2.

## Review and qualification

A human instruction identifies each authorized semantic change. Benchmark PRs carry the `benchmark` label and agents leave them for human review and merge. The source digest checks consistency with the lock; updating the lock is not human authorization. See [human authorization](../../guides/development/0016-writing-benchmarks.md#human-authorization).

On 2026-11-14 the user approved aligned B1/B2/B3/B7/B8 timing targets and B5 native-memory targets, and authorized reasonable B4 limits. See the [approved limits](../../guides/development/0016-writing-benchmarks.md#approved-acceptance-limits). B6 timing and aggregate scan/write ceilings remain pending. Existing approved guards remain binding for their matching workloads or explicitly unresolved in the ledger. PS-96 failures are not repaired by retirement. This candidate remains unqualified because of measured failures, incomplete phases and pending limits; optional M5 reference evidence is not a blocker.
