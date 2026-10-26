# Nonfunctional requirements

> **Human-editable only.** Agents must read and follow this file. Agents must not change its requirements or limits unless a human explicitly requests that change.

The [mission](MISSION.md) defines what belongs in Prompt Studio. The [design rules](design/DESIGN.md) define its interaction patterns. This document defines the resource, performance, and installation limits every feature, dependency, and release must respect.

## Limits

MB means 1,000,000 bytes; GB means 1,000,000,000 bytes. Time and memory limits apply to production builds with the normal default extensions and workload.

| Requirement | Maximum | Scope |
| --- | --- | --- |
| Core download | **200 MB** | Total mandatory download for one platform and installation channel, including the installer, runtime, bundled assets, and required follow-up downloads. |
| Compiled core binary | **200 MB** | The uncompressed CLI executable or desktop sidecar on every supported platform. |
| Cold start on Apple M5 | **2 seconds** | A stopped desktop app and stopped runtime, from process launch to a usable workbench. |
| Average memory during normal use | **1 GB** | The complete app process tree on the M5 reference machine, measured over the workload below. |
| Idle renderer work | **2% script time; 5% task time** | Each measured renderer's main thread over 10 seconds after a 2-second settle, as defined by the existing renderer benchmarks. These are wall-time shares, not whole-app OS CPU percentages. |

These limits are product requirements. Verify them using the measurements below. Average memory does not describe peak memory. Record both.

## Download and installation

Measure the bytes transferred for a fresh installation with empty download caches. Count every required payload once. The desktop channel includes Electron and its runtime; the CLI channel includes its compiled runtime. Moving mandatory payloads to a later download does not reduce the total.

Optional extensions, explicitly requested browser engines or agent tools, updates, and user project data are separate downloads. Report them separately. A required first-use dependency belongs in the core total.

Core installation and default extension installation must work without system Git, Xcode, or developer command-line tools on macOS, Linux, and Windows. Git features use working system Git and remain unavailable when it is absent. Starting the app must never invoke an operating-system developer-tools installer.

## Cold start

The reference machine is a native Apple M5 Mac with 10 CPU cores and 32 GiB of RAM, matching the hardware recorded in the [navigation measurements](documentation/references/performance/0004-sidenav-subnav.md#results-2026-10-20). Record the exact model, macOS version, power mode, and memory configuration with each result.

Use the packaged release app, an empty application home, and no running app-owned processes or persistent runtime. Do not prelaunch the app, prime its database, or remove default extensions. Record cache state and any operating-system first-launch checks.

Start the clock when the desktop process is launched. Stop when the workbench is visible, accepts input, the authenticated core API is ready, and the default tools needed for first use are ready. A splash screen, visible shell, or health endpoint alone does not count. Keep separate phase timings for database startup, extension preparation, and workbench readiness.

Measure at least 10 independent cold launches. Each launch must take at most 2,000 ms; a fast average cannot hide a slow launch. Retain every sample and report the median, p95, and maximum. Measure an existing user's saved project and a warm attachment separately; they must not substitute for the cold workload.

## Memory and idle work

Use one local project with the default extensions, a completed 100-message conversation, one open file, and one idle terminal. During a 10-minute recording, repeat the same sequence of opening and closing the conversation, file, and panels. Keep the fixture and action schedule fixed between revisions. Run active agents, builds, large projects, and optional extensions as separate recorded workloads.

After a 30-second settle, sample at least once per second. At each sample include every app-owned process: desktop main, renderers, GPU and utility helpers, the local runtime, and extension hosts. Compute the time-weighted mean of the total over the full window. Also retain startup and steady-state peaks, process counts, missing samples, and memory after repeated open/close cycles. Resource use must return to a stable range; caches and retained views must stay bounded as work repeats.

On macOS use OS-attributed physical footprint, including compressed memory. Record RSS and JavaScript heap separately. Shared resident pages must not be counted as an exact physical-memory total. On Linux and Windows retain the native memory metric and its meaning; unavailable or incomparable measurements cannot establish compliance with the M5 physical-footprint target. The [performance diagnostics reference](documentation/references/extensions/0027-performance-diagnostics.md#snapshot-data) describes the existing fields.

Idle renderers must not run continuous render loops. Background polling must stay within budget and stop when its owner is released. The [renderer benchmarks](documentation/guides/development/0002-testing.md#desktop-benchmarks) measure workbench and extension renderers separately, including monitoring overhead. Renderer timings cannot establish a whole-app CPU or memory ceiling.

## Verification and changes

Every result must identify the source revision, packaged artifact, hardware, OS, workload, units, start/end events, and raw samples. A missing measurement is unverified. A failed measurement is a requirement failure. Do not change a workload, move required work outside the measured interval, or increase a limit to make a check pass.

Current coverage:

- Local builds, all cross-platform builds, and prebuilt verification enforce the 200 MB compiled-binary limit through [the shared size guard](scripts/build/core-binary-size.ts).
- An aggregate fresh-install download check is still needed. Passing the binary-size guard alone does not verify the desktop installer or follow-up downloads.
- A dedicated M5 startup check with the readiness boundary above is still needed. The existing [packaged launch benchmark](clients/desktop/src/e2e/packaged-launch.p3.bench.ts) uses other CI hardware budgets and a visible-workbench milestone; passing it does not prove the 2-second M5 requirement.
- A checked-in implementation of the memory workload and an automated gate for the 1 GB average limit are still needed. The existing capture tools provide measurements, not a passing memory-budget result.

Read this document before changing runtime dependencies, packaging, startup, storage, extensions, or background work. New work must preserve these limits. Changes to a limit require a human decision recorded here and in the owning check; [execution allowances](documentation/adrs/0067-separate-performance-budgets-from-execution-allowances.md) remain separate from product limits.
