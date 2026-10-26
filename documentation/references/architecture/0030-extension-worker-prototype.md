# Extension execution measurements

The responsive extension execution PRD records a worker experiment from 2026-10-24. Its original fixture source is absent from this checkout. The numbers below distinguish that supplied evidence from the recreated production-path fixture.

## Supplied historical evidence

The [PRD](../../requirements/platform/0015-responsive-extension-execution-and-builds.md#evidence-and-current-implementation) reports three Linux trials with four available CPUs and 1,000,000,000 checksum iterations. Inline and worker execution both took about 1.2 seconds. Worker p95 latency was 1.70 ms for health, 2.48 ms for a database-backed project read, and 5.52 ms for another extension command. Inline probes completed no requests during the calculation.

These are the PRD's historical observations, not independently reproduced results. The original worker adapter supported only three storage methods. It is not the production implementation.

## Recreated fixture v1

On 2026-10-26, the requester authorized recreating the missing fixtures. The maintained entry point is:

```sh
bun run --cwd packages/pstdio-api perf:extension-isolation
```

The script starts a separate HTTP driver and a fresh real API host with an isolated PGlite database for each trial. It alternates inline/subprocess order across three paired trials. Both modes use the same generated extension, host storage and API routes. The subprocess mode sets the internal owner comparison control; it never substitutes a mock callback or imports that extension into the API.

The command performs exactly 1,000,000,000 integer checksum additions. The fixture verifies the expected checksum, persistence through host storage, and a distinct execution PID. Reload changes the entry to perform exactly 250,000,000 checksum additions during top-level initialization, calls the actual Reload endpoint, and verifies successful adoption and its computed result. A separate infinite-loop command writes a start marker before looping. Recovery uses the public execution HTTP route: inspect the affected project, Stop, Restart, then a fresh command reading persisted data. The fixture uses the test app's authentication configuration; it does not claim authenticated-session coverage.

Each unrelated operation has one HTTP request in flight and a 20 ms pause after its response. Raw samples include stalled requests completing after the work ends. The report contains both the full operation window and the extension's actual computation timestamps. Requests completing during setup or after CPU work are not counted as progress during computation.

Every run writes `metadata.json`, `results.json`, per-trial results and host logs under repository-root `test-results/extension-responsiveness/isolation/`. Metadata includes fixture version and SHA-256, source revision/dirty state, lock hash, Bun/OS/CPU/memory observations and cgroup/affinity observations when readable. Failure records and logs are retained. Generated fixture sources are retained with their trial, outside package type-check discovery. The checksum and initialization counts have no reduced-workload override.

## Native development observation

Hardware: Apple M5, 10 available CPUs, 16 GiB RAM, macOS arm64, Bun 1.4.4. This is not the PRD's Linux cgroup reference profile.

The clean measured revision is [301f27628](https://github.com/pufflyai/prompt-studio/commit/301f27628d391c4f7fc02d81883c2f506424b5cb), fixture SHA-256 `8932ea9565b35b931dc5081a98e21be4519cde72d63f28b01fce13ba3ba44474`. These trials include the corrected macOS Mach CPU timebase conversion. Earlier uncorrected native CPU samples must not be compared as calibrated core usage.

Three recreated pairs measured 315.88 ms median inline command completion and 312.76 ms subprocess completion. During actual computation, inline health/project/other-command probes completed zero requests. The subprocess probes completed 42/42/41 requests, with pooled p95 latencies of 0.82/1.08/3.67 ms and maxima of 1.60/1.83/14.96 ms. All requests succeeded.

During actual initialization through Reload, subprocess p95 was 0.59/1.14/2.59 ms and maximum was 1.16/1.34/4.06 ms. Public Stop, Restart and a fresh storage read took 191.98–207.77 ms. Reload completion itself was slower than inline, 205.87 ms versus 127.57 ms median, including subprocess startup and publication. Host snapshots retain the latest owner CPU/RSS observations, their measurement windows and explicit missing-sample diagnostics. They are point observations, not peak resource measurements.

These are development measurements on the recreated fixture, not a reproduction of the original Linux experiment or approval of native platform budgets. The PRD's four-CPU Linux/cgroup/16-GiB profile, authenticated harnesses, live-sync pressure, constrained-machine matrix and other native targets remain release gates. The [rollout inventory](0032-extension-owner-rollout.md) names the incomplete surfaces.

## Linux container observation: four CPUs, 6 GiB

Three additional pairs ran at clean revision [ea705501a](https://github.com/pufflyai/prompt-studio/commit/ea705501ac2ce6d8369d1f27b36db6f0409ae173), Bun 1.4.4, Linux arm64 in Docker Desktop on the same Apple M5. Affinity was CPUs 0–3, `cpu.max` was `400000 100000`, and `memory.max` was 6,442,450,944 bytes. The VM's kernel reported an unknown CPU model; the physical host model is recorded separately. The image manifest was `oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d`. The dependency install, SDK build and empty-database preparation preceded the measured trials; each trial still used a fresh API/storage root and the prescribed workloads.

Median command completion was 314.98 ms inline and 316.30 ms with owners. Inline probes completed no requests during actual computation. Owner health/project/command probes completed 42/42/39 requests, with pooled p95 0.77/0.89/3.08 ms and maxima 0.89/1.03/3.63 ms. During actual Reload initialization, owner p95 was 0.25/0.52/2.46 ms and maximum was 0.99/1.08/2.48 ms. Public recovery took 207.91–213.38 ms. Every probe succeeded.

This is a separate constrained development profile. Its 6 GiB memory limit does not satisfy the proposed 16 GiB reference gate, and resource admission remained disabled to preserve the preparation comparison. Raw metadata retains the actual cgroup/headroom readings and identifies the fixture revision.
