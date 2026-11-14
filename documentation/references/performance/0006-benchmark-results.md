# Benchmark results

The permanent catalog is [B1–B8](../../../packages/benchmarks/src/catalog/scenarios.ts), revision 1. See [workload guidance](../../guides/development/0016-writing-benchmarks.md) and the [migration ledger](0009-frozen-workload-ledger.md). The previous nine families and their historical results are retired history; they are not comparable with this series.

## Execution and ownership

[suites.ts](../../../packages/benchmarks/src/suites.ts) maps each scenario to one program and its required hosts. The [Benchmarks workflow](../../../.github/workflows/benchmarks.yml) can collect one first attempt per selected commit/scenario/platform. Nightly and stable release validation use the same registered programs; desktop release consumers retain actual signed artifacts. Source-built comparisons cannot certify published artifacts.

PR and queue run only catalog verification. Editing a benchmark does not schedule its measurements in the ten-minute gate. Temporary profiling stays outside discovery and these workflows. CI never repeats a scenario to obtain a passing result.

## Raw evidence

`test-results/production-performance/B1.jsonl` through `B8.jsonl` contain started, observation, metric and finished/failed records. Each has source SHA, catalog digest/revision, retained human approval receipt, scenario version and fixture fingerprint, actual platform/CPU/cores/RAM, cache and throttle, sample and plan/run/execution identity. Artifact hashes and owned process details are observations. The manifest declares exact metric IDs and units.

A consumer checks identity again after transport. Missing, duplicate, extra, nonfinite, stale, dirty-source, unapproved or incomplete measurements fail. Unqualified limits/reference hardware cannot read as green. Raw budget outcomes are retained before failure. A baseline capture is labelled unqualified even if all observed values happen to be low.

## Aggregate result format 2

The comparison runner also writes `<sha>-<platform>.json`, with `format: 2`, commit, platform, runner, start/end times, suite metadata and metrics. Each metric includes `suite`, `metric`, `label`, `unit`, optional approved `budget`, `identity`, every raw `values` observation and `maximum`. There is exactly one observation for a metric per sample; duplicate observations are an error. No within-sample median reduction is performed.

Units are `ms`, `bytes`, `share`, `percent` and `count`. Missing measurements never become zero. Physical memory, RSS and JS heap are separate metrics. Lower values alone do not establish correctness or responsiveness.

Comparisons require equal scenario/workload version and fixture fingerprint, catalog digest, platform/host class, RAM/cores, cache, throttle, units and approved limit. Product code changes may share a workload series; semantic workload changes start a newly authorized version. Old format-1 results remain historical and must not be silently compared to format 2.

## Review and qualification

A human instruction identifies each authorized semantic change. The protected `benchmark-catalog` environment records approval of an immutable commit's lock; a self-edited lock cannot pass verification. See [human authorization](../../guides/development/0016-writing-benchmarks.md#human-authorization) for bootstrap and required-status activation limitations.

New latency metrics are pending human decisions based on exact-workload actual-host baselines. Existing approved guards remain binding for their matching workloads or explicitly unresolved in the ledger. PS-96 failures are not repaired by retirement. Neither this candidate nor its unrun reference workloads are qualified yet.
