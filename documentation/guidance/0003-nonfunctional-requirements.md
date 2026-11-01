# Nonfunctional requirements

## 1. Scope

1. All targets are mandatory for production builds.
2. Changes to target values require human approval.
3. Measure production builds with default extensions. MB and GB use decimal units.

## 2. Size and installation

1. **Core download: ≤200 MB** per platform and installation channel, including the installer, runtime, assets, and required follow-up downloads.
2. **Compiled core binary: ≤200 MB** uncompressed for the CLI executable or desktop sidecar on every supported platform.
3. Core and default extensions must install on macOS, Linux, and Windows without system Git, Xcode, or developer command-line tools.

## 3. Performance

1. **Cold start: ≤2 seconds** on Apple M5 (10 CPU cores, 32 GiB RAM), from desktop process launch to an interactive workbench with the core API and default tools ready. Start with an empty app home and no app-owned processes running.
2. **Average memory: ≤2 GB** across all app-owned processes on the M5 reference machine. On macOS, use physical footprint, including compressed memory.
3. Memory workload: one local project, default extensions, a completed 100-message conversation, one open file, and one idle terminal. Measure 10 minutes of repeated opening and closing of the conversation, file, and panels after a 30-second settle.
4. **Idle renderer work: ≤2% script time and ≤5% task time** per renderer main thread over 10 seconds after a 2-second settle. These are shares of elapsed time, not whole-app CPU usage.

## 4. Verification

1. Performance tests run in nightly CI and stable-release validation. Existing benchmark budgets still apply; dedicated M5, average-memory, and aggregate-download checks are not implemented yet. Missing automated checks do not waive these targets.
2. Agents **SHOULD** run relevant local benchmarks for changes with significant performance impact. Ordinary changes can rely on nightly coverage.
3. Use [writing benchmarks](../guides/development/0016-writing-benchmarks.md) for commands and measurement guidance, and [CI stages](../guides/development/0015-ci-stages.md#nightly-full-validation) for the schedule.
