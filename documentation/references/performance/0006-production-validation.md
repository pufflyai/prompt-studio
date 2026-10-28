# Production performance validation

P3 runs the maintained acceptance workloads on exact candidate inputs. Manual and automatic runs use the same commands in `scripts/ci/production-performance.ts` and `.github/workflows/production-desktop.yml`. Existing operation budgets, fixed workloads, sample counts and execution allowances remain in their owners. No new release ceilings are introduced.

## Enabled workloads

| Family | Definitions | Contract |
| --- | --- | --- |
| Signed desktop | `clients/desktop/src/e2e/packaged-launch.p3.bench.ts`, `packaged-renderer.p3.bench.ts` | Every named launch/renderer operation and existing platform budget, on all four desktop targets. Fresh performance runners receive the exact signed candidate app. Daily Windows nightlies use an explicitly source-only diagnostic because no Windows desktop app is published nightly. |
| Browser | UI `chat-rendering.p3.perf.ts`, `chat-panel.p3.perf.ts`; every e2e `src/perf/*.perf.ts`; `packaged-paged-collections.p3.bench.ts` | Maintained three-repeat browser configurations and existing operation assertions. The frontend runs directly on restored candidate output. Chat builds its own measurement Canvas. |
| Navigation | `subnav.p3.bench.ts` | Default 30 samples and the fixed 15,000-file / 1,000-ticket / 1,000-session / five-workspace workload. Structure/data/editor budgets are set from hosted ubuntu-24.04 runs ([sidenav and subnav](0004-sidenav-subnav.md)). |
| Planner | `planner-stress.p3.bench.ts --packaged`, `planner-board-cold-open.p3.bench.ts` | Maintained 1,000-ticket workload and three default cold-open samples. Cold-open uses its CI-qualified target ([board cold open](0002-planner-board-cold-open.md)). Stress measurements remain informative where no timing ceiling exists. |
| Backend | Harness session resources, worktree cleanup, workbench resource inventory, session queries, document storage history | Fixed default standalone benchmark workloads on Linux, macOS and Windows. Correctness assertions remain blocking. Measurements without an existing operation ceiling remain informative. |
| Relay | `services/relay/scripts/storage-bound.p3.bench.ts` | Maintained disposable-container workload and existing storage-bound contract. |

Run an enabled family manually after restoring the candidate archive and installing its declared browser/native dependencies:

```sh
bun scripts/ci/production-performance.ts backend
bun scripts/ci/production-performance.ts browser
bun scripts/ci/production-performance.ts navigation
bun scripts/ci/production-performance.ts planner
bun scripts/ci/production-performance.ts relay
```

Each family runs one workload at a time on its runner. It streams errors, completes independent workloads and saves the aggregate result plus CPU, memory, image, toolchain, source and artifact metadata. Setup and builds finish before accepted measurements. Desktop benchmarks use their maintained no-trace config and a fresh runner before any packaged app launch. An execution timeout is incomplete evidence, not an operation-budget regression.

## Storage scale remains a separate diagnostic

The full rich/small storage-scale track is explicitly diagnostic under [the maintained contract](0005-storage-scale-diagnostic.md). Its controller returns failure for incomplete or layer-only acceptance. These entrypoints cannot be promoted into a passing release gate by calling workers with missing arguments or treating layer measurements as full user-visible acceptance:

- `packages/pstdio-sync/src/relay/document-scale.diagnostic.ts`
- `packages/pstdio-db/src/services/extension-storage/document-scale.diagnostic.ts`
- `packages/pstdio-db/src/services/extension-storage/record-read-scale.diagnostic.ts`
- `packages/e2e/src/perf/storage-scale.ts`, its preparation, sample and constrained-runtime controllers

Acquire the acknowledged exclusive timing window described in that contract, build the compiled runtime before timing, then use the maintained supervisor for **every** frozen layer workload: rich 1,000 and 10,000 rows; small 1,000, 10,000 and 100,000 rows; sync and database layers; the contract's distinct churn variants. Do not reduce rows or sample counts. For each combination:

```sh
bun packages/e2e/src/perf/storage-scale.ts --fixture rich --output /absolute/evidence/rich-1000-sync --layer sync --rows 1000 --timing-owner /absolute/owner.json
bun packages/e2e/src/perf/storage-scale.ts --fixture rich --output /absolute/evidence/rich-1000-database --layer database --rows 1000 --timing-owner /absolute/owner.json
```

The database supervisor prepares the complete closed fixture, copies it before fresh sample workers and retains all ten samples. The read diagnostic has its own maintained preparation/sample controller:

```sh
bun packages/pstdio-db/src/services/extension-storage/record-read-scale.diagnostic.ts small 100000 /absolute/disposable/read-fixture prepare
PSTDIO_SCALE_READ_COLD=view bun packages/pstdio-db/src/services/extension-storage/record-read-scale.diagnostic.ts small 100000 /absolute/disposable/read-sample-01 sample /absolute/disposable/read-fixture
```

Repeat fresh samples for every maintained cold operation and full frozen workload described in the diagnostic contract. These results do not grant production release acceptance. PS-909 owns the later full release contract. P3's production report certifies only its enabled acceptance workloads and does not claim that these diagnostic families have become release certification.

## Native CLI target ownership

Production native CLI validation covers Linux x64/arm64, macOS x64/arm64 and Windows x64/arm64. The [official hosted-runner catalog](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) supplies `ubuntu-24.04-arm` and `windows-11-arm`; Bun 1.4.4's [release assets](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4) include both aarch64 runtimes. Each full CLI suite retains the maintained Intel 60-second and other-platform 30-second allowance. Cross-compilation alone is not native execution evidence. Native ARM runs and their browser-install limitations must be assessed from real CI results before claiming complete platform coverage.
