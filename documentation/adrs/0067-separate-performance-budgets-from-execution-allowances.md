# Separate performance budgets from execution allowances

Proposed: 2026-10-10

Status: Accepted

## Context

A test or CI job does more than the product operation it checks. It also builds and signs apps, creates real databases, starts processes, drives automation, saves traces, and cleans up. When this work grows, a test can reach its time limit without any product regression. A test can also finish inside its limit while the product operation it contains is too slow.

The repository policy treated every time limit as a performance limit. The packaged desktop transport test combined the cold-start budget, authentication, project creation, CLI calls, and shutdown under one 30-second limit. On a hosted Intel runner, an unchanged baseline reached the workbench in 18.89 seconds, inside its 20-second budget, and then timed out at 30.5 seconds. Startup helpers also had their own 10-second waits, shorter than the 20-second startup budget they served. PR [#991](https://github.com/pufflyai/prompt-studio/pull/991) links the CI evidence for PS-577.

## Decision

Use two kinds of limit with different owners.

- A **performance budget** is a product contract. It names one operation, a fixed workload, the measured process, start and end events, a unit, and a limit. Benchmarks own budgets. Desktop benchmarks live in `clients/desktop/src/e2e/*.bench.ts` and run with `bun run --cwd clients/desktop test:benchmark`.
- An **execution allowance** bounds how long a test, fixture, or job may run before it is treated as hung. It covers setup, the operation, and cleanup. Test runner configuration and workflow jobs own allowances. Reaching one means work did not finish; it is not a measured product duration.

Benchmarks exclude test-only setup, tracing, and cleanup from the measured interval. They include initialization a person waits for in that scenario, such as first-launch macOS checks. Functional tests keep their behavior checks and no longer assert timings. Helpers wait within the test's own deadline instead of adding shorter caps.

Every benchmark attaches one JSON record before checking its budget. The record includes the scenario, workload, boundaries, all metrics with units and budgets, source revision, sidecar checksum, and runner details. A missing or non-finite measurement fails the benchmark; it is never recorded as zero.

The release workflow runs benchmarks in their own step before the functional packaged suite. The functional suite still runs after a benchmark failure, and the job still fails. Both results are required for a release.

Extraction keeps the existing startup contracts. Before this change, the cold-start check was the first launch of the signed app only on Intel macOS, which runs only `@essential` tests. On other platforms, two packaged launches ran before it. The cold-start benchmark therefore runs last in its file: Intel runs it alone, as the first launch, and other platforms run it after the warm-attach and recovery benchmarks. The non-Intel budgets do not cover macOS or Windows first-launch checks. Measuring the first launch on those platforms needs its own budget decision.

Changing either kind of limit needs approval for the exact value. An allowance proposal uses phase timings from representative local runs and from the applicable CI platforms. A timed-out run is a lower bound, not a duration. Adding tests justifies reviewing the job allowance or sharding, not a longer per-test limit.

## Alternatives

- Keep every limit as a performance limit. This rejects legitimate setup and suite growth, and its failures do not say which part was slow.
- Raise every limit or mark tests slow. This hides hangs, spreads the policy across files, and still does not measure product speed.
- Mock expensive setup. This loses coverage of real databases, packaged runtimes, and processes.
- Add a benchmark service or package. The existing Playwright, CDP, and CI artifact flow already provide what is needed.

## Consequences

Benchmarks repeat some setup that functional tests also do, such as launching the app and creating a project. Their measured workloads stay fixed while functional tests grow. Benchmarks run without Electron traces, because trace screenshots and snapshots add renderer work; diagnose a failed budget with the traced functional suite or by profiling separately.

Separating the limits does not remove hosted-runner variance or fix slow startup. The decision itself changes no limits. On 2026-10-10 the user separately approved a 60-second Intel test limit and budgets about 20% above the slowest measured values for Intel and Windows cold start, the streaming replay, and three browser interactions. The testing guide and [ADR 0032](0032-temporary-macos-ci-indexing.md) record the evidence.
