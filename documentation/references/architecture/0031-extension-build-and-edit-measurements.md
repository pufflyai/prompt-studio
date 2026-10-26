# Extension build and edit measurements

The responsive extension execution PRD records a build experiment from 2026-10-25. Its original generated module payloads and harness are absent from this checkout. The recreated fixture preserves the specified counts and production paths; it does not claim byte-for-byte identity with that original source.

## Supplied historical evidence

The [PRD](../../requirements/platform/0015-responsive-extension-execution-and-builds.md#evidence-and-current-implementation) reports three trials with six views sharing 64 generated modules, a 100 ms watcher debounce, and a four-compiler control. Project-read p95 during a shared edit fell from 34.9 ms to 4.7 ms after preparation isolation. Another command's p95 fell from 50.3 ms to 10.0 ms. The historical compiler profiles observed 1.62–1.91 cores and 147.8–155.4 MiB peak RSS.

Those observations came from the supplied PRD. They have not been independently reproduced with the missing original fixture. They do not establish an optimal compiler count or production resource reserves.

## Recreated fixture v1

```sh
bun run --cwd packages/pstdio-api perf:extension-builds
```

The fixture generates exactly six managed views sharing exactly 64 modules. Each module exports 1,024 deterministic functions, and every namespace is retained in the view output. This module density is an explicit recreation choice because the original payloads were unavailable. Both compared modes receive identical files. Shared revision edits preserve byte length.

Three paired trials alternate inline and subprocess order. Each starts a fresh real API process and isolated PGlite database, empty build output and a separate HTTP probe driver. The production source watcher, 100 ms debounce, loader, graph scanner, hashes, manager, compiler, staging and publication code remain in use. Compiler concurrency stays at the current ceiling of four so this comparison measures preparation isolation separately from future resource-policy tuning.

The scenarios verify:

- Cold activation publishes all six views.
- An unchanged save runs zero compilers and retains the published revision.
- A shared same-size edit publishes its matching revision in all views.
- Five rapid saves include subsequent edits while real compiler processes are active; the latest revision must publish.
- An invalid edit records the matching build diagnostic and preserves every working output hash.
- Repair publishes the repaired revision and clears its relevant diagnostic.
- Shutdown leaves no preparation process alive. Failed cleanup makes the fixture fail, while fixture cleanup still reaps its own process.

Probe policy matches the [execution fixture](0030-extension-worker-prototype.md#recreated-fixture-v1). The result includes raw request samples, operation and observed compiler lifetime windows, compiler queue/spawn/exit events, cancellation counts, child CPU microseconds and peak RSS bytes from Bun resource observations. Missing measurements remain absent. Exit timestamps reflect when the host observes exit, so they also include event-loop delivery delay. API RSS is a point observation, not a measured peak. No throughput or hard CPU-quota claim follows from these measurements.

Reports, source files and host logs are retained under repository-root `test-results/extension-responsiveness/builds/`. Metadata records the fixture hash, exact counts, runtime/host observations and source revision. The fixture is intentionally fixed; workload size and debounce are not reduced to meet a budget.

## Findings and release gates

Three recreated pairs on Apple M5/macOS arm64, 10 available CPUs and 16 GiB RAM with Bun 1.4.4 produced these median operation times. Both modes retained the same four-compiler ceiling.

| Operation | Inline preparation | Subprocess preparation |
| --- | ---: | ---: |
| Cold six-view activation | 749 ms | 868 ms |
| Shared same-size edit | 773 ms | 644 ms |
| Five rapid edits | 1,123 ms | 1,219 ms |
| Repair and matching diagnostic clearance | 831 ms | 716 ms |

During shared edits, pooled project-read p95 fell from 249.22 ms to 9.47 ms (14.33 ms subprocess maximum). Another command's p95 fell from 269.46 ms to 25.29 ms (39.18 ms maximum). During rapid edits, project-read p95 fell from 247.87 ms to 7.83 ms (23.01 ms maximum), and command p95 fell from 250.46 ms to 17.48 ms (36.81 ms maximum). Every probe succeeded. Raw sample counts and completion-during-work counts remain in each trial's report; pooled latency uses all retained samples, including responses after work.

Every unchanged save ran zero compilers. Each rapid burst recorded subsequent saves during active compilation and published revision six. The subprocess runs still spawned twelve compilers per burst, including an obsolete batch; zero active cancellations were observed in those particular runs. This is not proof that obsolete work is eliminated. Active cancellation has separate functional regressions and still needs measurement under a slower compiler/admission profile.

The recreated fixture exposed watcher serialization that delayed newer revisions until old builds ended, source-cache invalidation that adopted backend edits during asset publication, and conflicting sibling status writes that repeated graph scans. Regression tests now cover those rules. Trusted source preparation uses the same scanning, hashing and staging functions in a Bun subprocess under the owner comparison control.

Native development runs must be read separately from the original Linux evidence. The cold-build and shared-edit completion comparison, p95/maximum latency, compiler CPU/RSS and cleanup results are recorded in raw trial reports. Native and constrained-host budgets, adaptive resource admission and the complete release matrix remain open. Default rollout stays off; see [the rollout inventory](0032-extension-owner-rollout.md).
