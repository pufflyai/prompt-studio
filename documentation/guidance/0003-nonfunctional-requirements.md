# Nonfunctional requirements

## 1. Scope

1. All targets are mandatory for production builds.
2. Changes to target values require human approval.
3. Measure production builds with default extensions. MB and GB use decimal units.

## 2. Size and installation

1. **Core download: ≤200 MB** per platform and installation channel, including the installer, runtime, assets, and required follow-up downloads.
2. **Compiled core binary: ≤280 MB** uncompressed for the CLI executable or desktop sidecar on every supported platform.
3. Core and default extensions must install on macOS, Linux, and Windows without system Git, Xcode, or developer command-line tools.

## 3. Performance

1. **Cold start: <5 seconds** on Linux x64, Apple Silicon Mac and Windows x64, from desktop process launch through an interactive workbench, authenticated core API, default tools and first successful interaction. Start with an empty app home and no app-owned processes. Startup-window first paint must take <1,200ms, workbench shell readiness <3,000ms, and first interaction <1,200ms. These user-approved targets replace the M5-specific two-second target; no exact reference hardware is required.
2. **Average whole-app memory: <2 GB** on Linux x64 and Apple Silicon Mac; **<3 GB** on Windows x64. Include all app-owned processes. Measure macOS physical footprint including compression, Linux resident set, and Windows private committed bytes in separately labelled platform series.
3. Memory workload: one local project, default extensions, a completed 100-message conversation, one open file, and one idle terminal. Measure 10 minutes of repeated opening and closing of the conversation, file, and panels after a 30-second settle.
4. **Idle renderer work: ≤2% script time and ≤5% task time** per renderer main thread over 10 seconds after a 2-second settle. These are shares of elapsed time, not whole-app CPU usage.

## 4. Verification

1. Performance tests run in nightly CI and stable-release validation. All eight frozen scenarios run on Linux x64, Apple Silicon Mac and Windows x64 in both channels; Intel Mac is excluded from benchmarks. Functional backend nightly coverage remains Linux and Apple Silicon macOS, with Windows added for stable validation. Apply the [approved timing and memory limits](../guides/development/0016-writing-benchmarks.md#approved-acceptance-limits), record actual hosts, and reject incomplete measurements. Benchmark and aggregate-download qualification remain incomplete; missing proof does not waive a target.
2. Agents **SHOULD** run relevant local benchmarks for changes with significant performance impact. Ordinary changes can rely on nightly coverage.
3. Use the [native memory sampling procedure](../guides/development/0016-writing-benchmarks.md#native-memory-sampling-procedure) for sampling, [writing benchmarks](../guides/development/0016-writing-benchmarks.md) for commands, and [CI stages](../guides/development/0015-ci-stages.md#nightly-full-validation) for the schedule.
