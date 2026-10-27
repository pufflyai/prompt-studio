# Nonfunctional requirements

> **Human-editable targets.** Changes to target values need a human request.

## Targets

These targets guide product and performance work. They are advisory for now and add no per-change benchmarking requirement or new release gate. MB means 1,000,000 bytes; GB means 1,000,000,000 bytes. The reference is a production build with the normal default extensions and workload.

| Measurement | Target maximum | Scope |
| --- | --- | --- |
| Core download | **200 MB** | Total mandatory download for one platform and installation channel, including the installer, runtime, bundled assets, and required follow-up downloads. |
| Compiled core binary | **200 MB** | The uncompressed CLI executable or desktop sidecar on every supported platform. |
| Cold start on Apple M5 | **2 seconds** | A stopped desktop app and stopped runtime, from process launch to a usable workbench. |
| Average memory during normal use | **1 GB** | The complete app process tree on the M5 reference machine, measured over the workload below. |
| Idle renderer work | **2% script time; 5% task time** | Each measured renderer's main thread over 10 seconds after a 2-second settle, as defined by the existing renderer benchmarks. These are wall-time shares, not whole-app OS CPU percentages. |

## When and where performance tests run

Regular performance coverage runs in nightly CI: [Release Packages](.github/workflows/release-packages.yml) calls [Production validation](.github/workflows/production-validation.yml), which calls [Production performance](.github/workflows/production-performance.yml). The nightly runs daily or through a manual `nightly` dispatch. Stable-release validation runs the same performance suite. The [CI stages guide](documentation/guides/development/0015-ci-stages.md#nightly-full-validation) describes the schedule and release flow.

The P3 suite covers:

- Packaged desktop startup, recovery, and renderer work on the selected native desktop runners.
- Backend workloads on Linux, macOS, and Windows.
- Browser, navigation, Planner, and relay workloads on Linux, selected by [the performance runner](scripts/ci/production-performance.ts).

Results, raw measurements, and machine metadata are attached to the GitHub Actions run. Workload artifacts are named `production-performance-<family>-<os>-attempt-<attempt>`; desktop artifacts are named `production-desktop-performance-<target>-attempt-<attempt>`. Existing benchmarks retain their own CI budgets and workloads.

## Local benchmark guidance

Agents **SHOULD** run the relevant performance benchmarks when they expect a significant performance impact from a change. Examples include changes to runtime dependencies or bundle contents, startup, storage and sync algorithms, large-list rendering, retained views, or background work. The choice of benchmarks depends on the affected behavior. Ordinary changes can rely on the regular nightly coverage; these targets do not call for a full performance run for every task.

For startup and desktop renderer changes, the [desktop benchmark guide](documentation/guides/development/0002-testing.md#desktop-benchmarks) describes packaging and local execution. [Packaged launch benchmarks](clients/desktop/src/e2e/packaged-launch.p3.bench.ts) cover startup and recovery; [renderer benchmarks](clients/desktop/src/e2e/packaged-renderer.p3.bench.ts) cover idle and streaming work. For backend, browser, navigation, Planner, or relay changes, the performance runner above lists each workload's command. Memory investigations can use the [performance diagnostics](documentation/references/extensions/0027-performance-diagnostics.md#snapshot-data).

## Measurement definitions

### Download and installation

The download figure counts transferred bytes for a fresh installation with empty download caches, including each required payload once. The desktop channel includes Electron and its runtime; the CLI channel includes its compiled runtime. Required follow-up downloads are part of the total. Optional extensions, explicitly requested browser engines or agent tools, updates, and user project data are reported separately.

Core and default extension installation work without system Git, Xcode, or developer command-line tools on macOS, Linux, and Windows. Git features use working system Git when available.

### Cold start on M5

The reference machine is a native Apple M5 Mac with 10 CPU cores and 32 GiB of RAM, matching the [navigation measurements](documentation/references/performance/0004-sidenav-subnav.md#results-2026-10-20). Hardware model, macOS version, power mode, cache state, and operating-system first-launch checks provide context for a result.

A reference cold launch uses the packaged app, an empty application home, the default extensions, and no running app-owned processes or persistent runtime. Timing runs from desktop process launch to a visible, interactive workbench with the authenticated core API and default tools ready. Database startup, extension preparation, and workbench readiness are separate phase measurements.

The reference measurement uses 10 independent cold launches and reports every sample, median, p95, and maximum against the 2,000 ms target. Saved-project launches and warm attachment are separate scenarios.

### Memory and idle work

The reference workload is one local project with the default extensions, a completed 100-message conversation, one open file, and one idle terminal. A 10-minute recording repeats a fixed sequence of opening and closing the conversation, file, and panels. Active agents, builds, large projects, and optional extensions are separate workloads.

Sampling begins after a 30-second settle, at least once per second. The time-weighted average includes every app-owned process: desktop main, renderers, GPU and utility helpers, the local runtime, and extension hosts. Startup and steady-state peaks, process counts, missing samples, and memory after repeated open/close cycles are useful alongside the average.

On macOS the reference metric is OS-attributed physical footprint, including compressed memory. RSS and JavaScript heap are separate readings; summing shared resident pages does not give an exact physical-memory total. Linux and Windows results identify their native metric so comparisons retain its meaning.

Idle renderer measurements cover workbench and extension renderers separately, including monitoring overhead. Their script and task timings describe renderer main-thread work, rather than whole-app OS CPU or memory. Measurement records include the source revision, packaged artifact, machine, workload, units, timing boundaries, and raw samples.

## Current coverage

The existing [binary-size guard](scripts/build/core-binary-size.ts) runs during local builds, cross-platform builds, and prebuilt verification. It measures the compiled executable, rather than the aggregate fresh-install download.

The nightly packaged launch benchmark uses hosted-runner budgets and a visible-workbench milestone. There is no dedicated check for the 2-second M5 target or the 1 GB average-memory target yet, and no aggregate fresh-download check. Existing capture tools can support investigations. These coverage gaps are not additional tasks for an agent completing an ordinary change.
