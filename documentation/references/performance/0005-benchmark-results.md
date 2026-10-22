# Benchmark results

Every benchmark in the repository reports its measurements in one result format. GitHub Actions runs them, release runs attach their results to the GitHub release, and the **Performance** pages in the repository's `pstdio-dev` extension read them. Ticket: PS-920.

Benchmarks run only on GitHub Actions. A developer machine has other work running, so its numbers vary too much to compare commits.

## Suites

[`packages/benchmarks/src/suites.ts`](../../../packages/benchmarks/src/suites.ts) lists every suite: how each commit prepares it once (builds, browsers), how one sample runs, and which platforms support it.

| Suite | Source | Measures |
| --- | --- | --- |
| `desktop` | `clients/desktop/src/e2e/packaged-*.bench.ts` | Launch, recovery, renderer CPU share, renderer heap, and app memory |
| `workbench` | `packages/e2e/src/perf/*.perf.ts` | Workbench interaction times and page heap |
| `chat` | `packages/ui/src/components/chat-ui/performance/*.perf.ts` | Chat loading, switching, streaming, rendering, and page heap |
| `subnav` | `packages/e2e/src/perf/subnav-benchmark.ts` | Side navigation sections, data, and editor times |
| `planner` | `packages/e2e/src/perf/planner-board-cold-open.ts` | Tickets cold open with 1,000 tickets |
| `storage` | `packages/pstdio-db/src/services/**/*.bench.ts` | Record saves, session badge query, and peak memory |
| `runtime` | `pstdio-api`, `pstdio-api-runtime-host`, and `pstdio-workbench` `*.bench.ts` | Session resources, open-resource lookups, workspace cleanup, and peak memory |
| `relay` | `services/relay/scripts/storage-bound.bench.ts` | Relay storage bound; Linux only, because it needs Docker |

The Planner moves stress test, its validation script, the Planner stress report, and the Planner reorder fixture are diagnostics. They need a Docker development stack or live inside the Planner extension, so the suites leave them out.

## Report a measurement

Import the writer from `pstdio-benchmarks/writer` and call it after the workload, before any budget assertion:

```ts
import { recordMeasurement, recordPeakMemory } from "pstdio-benchmarks/writer";

recordMeasurement({ metric: "cold-start", label: "Cold start", unit: "ms", value: readyInMs, budget: 8000 });
recordPeakMemory("cold-start-memory", "Cold start peak memory");
```

- `metric` is a stable id within the suite. Changing it starts a new series.
- `unit` is `ms`, `share`, `percent`, or `bytes`. Lower is better for every unit.
- `budget` is optional. It repeats the benchmark's existing budget; the writer never adds a new one.
- The writer does nothing unless the runner sets `BENCHMARK_RESULTS`, so benchmarks still run on their own.

A new suite needs an entry in `suites.ts` and in `SUITES` in `.pstdio/extensions/pstdio-dev/src/benchmarks/platforms.ts`, which the Runs page offers.

## Run benchmarks

The [Benchmarks workflow](../../../.github/workflows/benchmarks.yml) takes commits, suites, platforms, and samples per commit. It runs one job per platform and suite. Each job checks out every commit into its own folder, installs and prepares each one, then runs the commits in turn for each sample: A then B, then B then A. Runner drift therefore affects every commit equally. Each commit runs its own copy of the runner and benchmarks, so a commit from before this format cannot be measured.

Start a run from the Runs page, or with GitHub CLI:

```sh
gh workflow run benchmarks.yml -f commits=pstdio@0.45.0,main -f suites=storage,runtime -f platforms=linux-x64 -f samples=10
```

The runner also works locally, for checking a suite change. Its numbers are not comparable with CI results:

```sh
bun run --cwd packages/benchmarks bench run --checkout ../..=$(git rev-parse HEAD) --suites storage --samples 2 --out /tmp/benchmark-results
```

A pull request that changes `packages/benchmarks` or the workflow measures its own head with the `storage` and `runtime` suites, to prove the runner still works.

## Result file

Each job uploads `<sha>-<platform>.json` files as the `benchmark-results-<platform>-<suite>` artifact:

```json
{
  "format": 1,
  "commit": { "sha": "65d36f4…", "ref": "main" },
  "platform": "linux-x64",
  "runner": "ubuntu24",
  "run": { "id": "1042", "url": "https://github.com/…/actions/runs/1042" },
  "startedAt": "2026-10-22T09:00:00.000Z",
  "finishedAt": "2026-10-22T09:40:00.000Z",
  "suites": [{ "id": "storage", "label": "Storage", "source": "packages/pstdio-db/src/services/**/*.bench.ts" }],
  "metrics": [{ "suite": "storage", "metric": "badge-query", "label": "Session badges for 28 workspaces", "unit": "ms", "values": [8.9, 9.1] }]
}
```

`values` holds one value per sample, in run order. A benchmark that measures something several times in one sample contributes that sample's median, because samples, not single measurements, are the independent units. Readers compute their own statistics from these values. A failed sample keeps the measurements it recorded; the job still fails so the run shows it. A measurement that is not a finite number is left out.

After a stable or patch release publishes, the release workflow starts a separate Benchmarks run with `release_tag` set. It runs every suite on every release platform, merges each platform's suite files, and attaches them to the release as `benchmarks-<platform>.json`. Benchmarks never hold or fail a release.

## Performance pages

The pages read only from `.pstdio/extension-storage/pstdio-dev/benchmarks/`. Opening a page, the daily schedule, and a followed run download new release assets and finished run artifacts there with the developer's `gh` login. Cached results outlive GitHub's artifact retention. Extension storage is not tracked by Git, so each developer keeps their own cache.

- **Trends** shows each metric's median across releases with a 95% confidence interval and its budget. **One version** lists every metric for one release against the previous one.
- **Compare** shows base and head medians with intervals, and the change with its interval. When a run measured both commits, its results win over separate runs.
- **Runs** starts and cancels workflow runs and shows their progress.

Medians use percentile bootstrap intervals with 2,000 resamples. A change counts as an improvement or a regression only when the 95% interval of the change in medians excludes zero. A metric whose base median is zero, such as idle CPU, reads as "up from 0" when it rises.
