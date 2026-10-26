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

The command performs exactly 1,000,000,000 integer checksum additions. The fixture verifies the expected checksum, persistence through host storage, and a distinct execution PID. Reload changes the entry to perform exactly 250,000,000 checksum additions during top-level initialization, calls the actual Reload endpoint, and verifies successful adoption and its computed result. A separate infinite-loop command writes a start marker before looping. The supervisor Stop/Restart control must settle it and allow a fresh invocation to read the saved result. That recovery check currently uses internal supervisor control, not a completed public Stop API.

Each unrelated operation has one HTTP request in flight and a 20 ms pause after its response. Raw samples include stalled requests completing after the work ends. The report contains both the full operation window and the extension's actual computation timestamps. Requests completing during setup or after CPU work are not counted as progress during computation.

Every run writes `metadata.json`, `results.json`, per-trial results and host logs under repository-root `test-results/extension-responsiveness/isolation/`. Metadata includes fixture version and SHA-256, source revision/dirty state, lock hash, Bun/OS/CPU/memory observations and cgroup/affinity observations when readable. Failure records and logs are retained. Generated fixture sources are retained with their trial, outside package type-check discovery. The checksum and initialization counts have no reduced-workload override.

## Native development observation

Hardware: Apple M5, 10 available CPUs, 16 GiB RAM, macOS arm64, Bun 1.4.4. This is not the PRD's Linux cgroup reference profile.

Three recreated pairs on macOS arm64 measured 304.88 ms median inline command completion and 305.82 ms subprocess completion. During actual computation, inline health/project/other-command probes completed zero requests. The subprocess probes completed 42/42/41 requests, with pooled p95 latencies of 0.27/0.60/1.98 ms and maxima of 0.69/0.70/13.89 ms. All requests succeeded.

During actual initialization through Reload, subprocess p95 was 0.27/0.63/5.27 ms and maximum was 2.56/2.95/5.44 ms. Stop, Restart and a fresh storage read took 183.56–186.76 ms. Reload completion itself was slower than inline, 194.26 ms versus 121.06 ms median, including subprocess startup and publication.

These are development measurements on the recreated fixture, not a reproduction of the original Linux experiment or approval of native platform budgets. The PRD's four-CPU Linux/cgroup/16-GiB profile, authenticated harnesses, live-sync pressure, constrained-machine matrix and other native targets remain release gates. The [rollout inventory](0032-extension-owner-rollout.md) names the incomplete surfaces.
