# Benchmark results

Every benchmark in the repository reports its measurements in one result format. GitHub Actions runs them and keeps their results as run artifacts, and the **Performance** pages in the repository's `pstdio-dev` extension read them. Tickets: PS-920 and PS-924. See [Write a benchmark](../../guides/development/0016-writing-benchmarks.md) for naming, coverage, sampling, budgets and shared helpers.

Benchmarks run only on GitHub Actions. A developer machine has other work running, so its numbers vary too much to compare commits.

## Suites

[`packages/benchmarks/src/suites.ts`](../../../packages/benchmarks/src/suites.ts) lists exact benchmark files for every suite, preparation (builds and browsers), one-sample commands, and platform support. CI rejects missing or unregistered files.

| Suite | Source | Measures |
| --- | --- | --- |
| `desktop` | `clients/desktop/src/e2e/packaged-*.bench.ts` | Launch, recovery, renderer CPU share, renderer heap, and app memory |
| `workbench` | `packages/e2e/src/perf/*.p3.bench.ts` and the packaged collection benchmark | Workbench interaction times and page heap |
| `canvas` | `packages/canvas-tests/src/performance/frame-startup.p3.bench.ts` | Canvas frame cold startup |
| `chat` | `packages/ui/src/components/chat-ui/performance/*.p3.bench.ts` | Chat loading, switching, streaming, rendering, and page heap |
| `subnav` | `packages/e2e/src/perf/subnav.p3.bench.ts` | Side navigation sections, data, and editor times |
| `planner` | `packages/e2e/src/perf/planner-board-cold-open.p3.bench.ts` | Tickets cold open with 1,000 tickets |
| `storage` | `packages/pstdio-db/src/services/**/*.bench.ts` | Record saves, session badge query, and peak memory |
| `runtime` | `pstdio-api`, `pstdio-api-runtime-host`, and `pstdio-workbench` `*.bench.ts` | Session resources, open-resource lookups, workspace cleanup, and peak memory |
| `relay` | `services/relay/scripts/storage-bound.p3.bench.ts` | Relay storage bound; Linux only, because it needs Docker |

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

A new suite needs an entry in `suites.ts` and in `SUITES` in `.pstdio/extensions/pstdio-dev/src/benchmarks/platforms.ts`, which the Runs page offers. A P0 test in the extension, `platforms.p0.test.ts`, fails when its list differs from what the package's `describe` command plans on each platform.

## Run benchmarks

The [Benchmarks workflow](../../../.github/workflows/benchmarks.yml) takes commits, suites and platforms. CI runs each benchmark once (rule `005.3.5`), so its `samples` input must stay 1. It runs one job per platform and suite the suite supports; a chosen suite that cannot run on a platform, such as `relay` off Linux, starts no job and the run shows a warning. Each job checks out every commit into its own folder, installs and prepares each one, then runs the commits in turn. Each commit runs its own copy of the runner and benchmarks, so a commit from before this format cannot be measured.

Start a run from the Runs page, or with GitHub CLI:

```sh
gh workflow run benchmarks.yml -f commits=pstdio@0.45.0,main -f suites=storage,runtime -f platforms=linux-x64
```

The runner also works locally, for checking a suite change. Its numbers are not comparable with CI results:

```sh
bun run --cwd packages/benchmarks bench run --checkout ../..=$(git rev-parse HEAD) --suites storage --samples 2 --out /tmp/benchmark-results
```

Pull requests do not run this workflow. A PR that edits a benchmark file runs that benchmark's suite in its `edited_tests` check; runner changes are covered by their P0 tests and the nightly.

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

`values` holds one value per sample, in run order. CI results have one value per metric; older or local results can have several. A benchmark that measures something several times in one sample contributes that sample's median, because samples, not single measurements, are the independent units. Readers compute their own statistics from these values. A failed sample keeps the measurements it recorded; the job still fails so the run shows it. A measurement that is not a finite number is left out.

After a stable or patch release publishes, the release workflow starts a separate Benchmarks run with `release_tag` set. It runs every suite on every release platform. Benchmarks never hold or fail a release.

Releases are immutable once published, so results cannot be attached to them. A release's history is every result for its commit instead: its release run's artifacts, and any later run of its tag, such as one started from the Runs page to fill a failed platform. GitHub keeps artifacts for 90 days, and the Performance pages cache them on their daily sync. Releases published before this change, which carry `benchmarks-<platform>.json` assets, still read from those.

## Performance pages

The pages read only from `.pstdio/extension-storage/pstdio.pstdio-dev/benchmarks/`. Opening a page, the daily schedule, and a followed run download new release assets and finished run artifacts there with the developer's `gh` login. Cached results outlive GitHub's artifact retention. Extension storage is not tracked by Git, so each developer keeps their own cache. When a sync fails, the pages keep showing cached results with the time of the last successful sync and a **Retry sync** action.

- **Trends** shows one chart per benchmark across releases, with one line per chosen platform. With one platform it also shows the 95% interval band. **Show table** lists every release and platform as a row and every benchmark as a column. When the newest release lacks results on some platforms or some of its suites failed, a notice names which platforms have results, which are still running, which have none, and which suites failed. Measuring the release's tag from Runs fills the gaps. A release a platform did not measure is a gap, never a zero.
- **Compare** shows the base and head values and their difference. Any two commits compare, whichever runs measured them; a metric one commit lacks shows as not measured. With no base, the head's own measurements and budget outcomes show. When a chosen commit has no results, **Measure** starts a run for only that commit on the chosen platform.
- **Runs** starts and cancels workflow runs. The commit input lists every release tag; commits that already have results for the chosen suites and platforms are tagged Measured and are not run again. Suites a chosen platform cannot run are disabled with the reason. Each run shows its status, commits, platforms and start time, with each suite's outcome in the status tooltip. Runs started anywhere, including by releases and on GitHub, keep updating while they run.

## What results can show

A median with several samples uses a percentile bootstrap interval with 2,000 resamples. A change counts as an improvement or a regression only when the 95% interval of the change in medians excludes zero. A metric whose base median is zero, such as idle CPU, reads as "up from 0" when it rises.

One sample per commit, which every CI result has, has no spread. Its difference and budget outcome are real measurements, but there is too little evidence to call it improved or regressed, so it gets no interval and the verdict `inconclusive`. A suite stopped by a cancel saves no measurements; suites that finished before it keep theirs.

## Agent commands

Agents use the same commands as the pages: `pst pstdio-dev benchmarks sync` and `start-run` from the CLI, and `benchmarks.runs`, `benchmarks.run-results`, `benchmarks.commits`, `benchmarks.compare`, `benchmarks.trends`, `benchmarks.cancel-run` and `benchmarks.sync-status` through the extension command surface. `start-run` returns whether it dispatched a run, the run id once GitHub lists it, the commits it reused, and any skipped suite and platform pairs. `run-results` returns one run's measurements and the platforms that have none. A run that cannot be read or downloaded keeps its error on its own row; only failing to reach GitHub fails a sync.
