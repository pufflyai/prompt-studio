# Tests

## Validation

Use Bun 1.4.4 and Node 24, matching CI. Install dependencies with `bun install --frozen-lockfile`. The database workspace installation generates an empty engine image matched to the installed PGlite version. Source runtimes and migration workers restore this image instead of running PostgreSQL initialization for every open. It contains no application schema or user data; source startup still runs application migrations. Installations that use `--ignore-scripts` must run `bun run --cwd packages/pstdio-db postinstall` before starting the source API. The root pins `node-gyp` so native addon install scripts use the local build tool instead of a temporary `bunx node-gyp@latest` download.

When upgrading Bun, align the root `packageManager` pin, Bun engine requirements, all `@types/bun` dependencies, the lockfile, and every Docker image, including `infra/local/Dockerfile`. Update the local Bun executable and current setup documentation to the same version before validating.

Repository type checks use the TypeScript 7 checker built into Bun 1.4.4. Keep using each package's `typecheck` script: the dashboard checks both project references with `bun check -b`, UI uses `tsconfig.build.json`, and base themes also check `tsconfig.storybook.json`. Chakra token generation still runs before dashboard checking. TypeScript 6.0.2 remains installed for compiler API users and Rolldown declaration emit. Public package and provider consumers check the same positive and negative fixtures with both TypeScript 6.0.2 and `bun check`, so the faster checker preserves the supported consumer contract.

Editors using the workspace TypeScript version still show TypeScript 6 diagnostics. Run the package's `typecheck` script to see the required TypeScript 7 result; the two versions can differ in generic inference and removed configuration options.

The private workbench fixture keeps published dependency ranges for isolated installs. Its repository check uses `tsconfig.test-fixtures.json` to resolve the current SDK and UI public declarations. Nx builds those producers first and includes the repository config in the check's cache inputs.

Three alternating complete-process samples on macOS arm64 on 2026-10-25 produced these medians. TypeScript uses 6.0.2; Bun uses 1.4.4. UI uses its build config and dashboard TypeScript builds use `--force` so incremental no-ops are excluded. These local shared-machine results do not measure a CI speedup.

| Scope | TypeScript | Bun check |
| --- | ---: | ---: |
| SDK | 1.836 s | 0.087 s |
| UI | 7.978 s | 0.669 s |
| Workbench | 7.884 s | 0.491 s |
| API | 12.090 s | 0.862 s |
| Database | 3.149 s | 0.217 s |
| Dashboard references | 6.336 s | 0.304 s |

Keep package type-check concurrency at two. For the same six scopes with two package processes, default checker threads took a median 1.514 s versus 1.900 s with two threads per checker. The default thread count remains in use.

Native CI installs run `bun scripts/ci/install-native-dependencies.ts`. On Linux and macOS the installer reuses headers beside the Node executable on `PATH` when they exist, following symlinks to the installation directory. An explicit `npm_config_nodedir` takes precedence. Without local headers, node-gyp uses its normal header resolution when a native build needs it; their absence does not block dependency installation. The setting applies only to dependency installation; Electron packaging selects the headers for Electron separately.

Choose checks that cover the changed behavior and its affected callers. Start with one test file or one end-to-end spec. Run a package's tests, lint, type checks, or build when that is the smallest useful scope. After a failure, rerun only failed or affected checks. Do not repeat passing checks without a new change or unresolved concern.

Documentation-only changes need content, link, path, and formatting checks. A documentation path in a source comment, prompt, or test fixture does not by itself require application tests.

```bash
bun run --cwd scripts verify:docs-links      # relative links, published routes, anchors, exported skills
bun run --cwd scripts verify:sdk-reference   # SDK references name every public method
bun run --cwd scripts verify:docs-snippets   # authoring guide code equals infra/local/extensions/bookmarks
```

`static_checks` runs the first two on every stage. External sites are checked separately by the **Documentation links** workflow (`.github/workflows/docs-external-links.yml`) every Monday and on manual dispatch, so an outage elsewhere cannot fail a pull request. Run it locally with `bun run --cwd scripts verify:docs-external-links`.

```bash
bun test <path-to-test> # from the owning package directory
bun run --cwd packages/<name> test
bun run --cwd packages/<name> lint
bun run --cwd packages/e2e test:ui -- src/ui/<name>.spec.ts
bun run --cwd packages/storybook-tests test:browser -- src/ui/<name>.spec.ts
```

Run a single dashboard test through the package script, because the dashboard runner needs two flags:

```bash
bun run --cwd packages/pstdio-dashboard test -- src/workbench.p0.test.ts
```

The script runs `bun test --conditions production --tsconfig-override tsconfig.app.json`. `--tsconfig-override tsconfig.app.json` loads the `@/*` path alias; a plain `bun test <file>` in the dashboard fails with `Cannot find module '@/...'`. `--conditions production` makes dependencies resolve their `production` export condition, as the built dashboard does. `test:coverage` uses the same flags. The dashboard imports `@pstdio/ui` and `@pstdio/workbench` from their `dist` folders, so build them first after changing them.

Build the affected package's dependencies first when its checks load compiled exports. Changes to packaged runtime behavior, assets, or file inclusion also require the packaged checks described in `AGENTS.md`. Documentation-reference-only edits do not.

During implementation, run targeted tests. Before marking a draft PR ready, follow [Finishing a pull request](../../../AGENTS.md#finishing-a-pull-request), including the full test run after integrating main. Run full validation only when explicitly requested. For that case, `bun run validate` checks changesets, the lockfile, formatting, package boundaries, extension API versions, and the extension API report, then builds before translation checks, lint, and tests. `bun run test` runs unit packages through Lerna, then the E2E script, CLI, UI, Vite terminal, and separate Storybook suites. `bun run test:e2e` runs app checks; `bun run test:storybook` runs component server checks and browser interactions. Lerna excludes both browser packages from its unit pass. Packaged and desktop tests run separately in CI.

Install browser dependencies before running browser tests:

```bash
bun run --cwd packages/e2e playwright install --with-deps chromium firefox webkit
```

For manual app validation, use `bun run dev:playwright`, open the printed dashboard URL, and stop it with `bun run dev:playwright:down`. Do not start a development server directly or use the developer database.

Run `bun run --cwd packages/e2e test:smoke` for basic dashboard browser E2E. It runs the real dashboard with isolated runtime data, without starting Storybook. The discovered startup P1 file covers empty and selected project flows and project switching. Keyboard/theme permutations remain in their P2 suite. These tests also run in the full UI suite.

API tests retain one fresh Bun process per file and at most two active files, with the existing 30-second per-test limit. Run focused API regressions with `bun run --cwd packages/pstdio-api test --files='["src/app-config.p0.test.ts"]'`. Unknown, duplicate, or empty explicit file selections fail. Without `--files`, the driver selects every API test file. `--shard=1/4` partitions that selection; optional `--timings=path.json` balances complete files from recorded durations. Timing files use Bun's `{ "version": 1, "files": { "src/example.test.ts": 120 } }` format. Missing durations use a measured fallback; no test is dropped because of elapsed time.

`scripts/ci/run-bun-tests.ts` adds `--bail=1` only for `CI_PRIORITY=P1`; other priorities collect all failures. The API scheduler also stops pending P1 files and waits for active child processes to stop. App Playwright uses `maxFailures=1` only for P1. Existing test limits, source conditions, and manual quarantine selection remain unchanged.

The Bun wrapper and API driver save reports under `test-results/ci/bun` and `test-results/ci/api`. Reports include actual source revision, platform, priority, JUnit case IDs and outcomes, executed counts, and per-file timings. API reports list every selected file and distinguish failures, P1 cancellation, external cancellation signals, and missing reports. A successful child without a case report fails. Bun's bailed JUnit omits later cases, so partial reports explicitly leave the unreported selected-case count unknown. Direct `bun test` calls do not produce these wrapper manifests.

## Test priorities

Every maintained test file declares one priority before its runner suffix: `.p0.test.ts`, `.p1.spec.ts`, `.p2.integration.ts`, or `.p3.bench.ts`. Tests remain next to the code they cover. Files with different priorities use separate fixtures. New files are discovered automatically; unclassified test filenames fail scope selection.

From the repository root:

```sh
bun test:p0
bun test:p1
bun test:p2
bun test:p3
bun test:p0 --scope pstdio-paths
bun test:p1 --runner component
bun test:p2 --list
```

These commands run exactly the named priority on the current host and build required dependencies first. `--scope` selects workspace names or directories; `--runner` selects an execution kind; `--list` prints the plan without executing it. CI uses `--prebuilt` after its declared build. Browser and desktop tests still need their maintained system prerequisites. A local priority run is not cross-platform or signed release certification.

P0 owns fast local rules and static checks. P1 owns essential integrated product contracts. P2 owns full feature, browser, platform and distribution breadth. P3 owns maintained performance and endurance acceptance workloads. A slow essential behavior stays P1. Merge duplicate assertions under one owner; do not move an assertion to nightly only because it takes time.

See [CI stages](0015-ci-stages.md) for when each priority runs.

## Unused code

`bun run knip` reports unused files, exports, and dependencies across the workspace. CI runs it in the `static_checks` job, so a pull request fails when it leaves dead code or an unused dependency behind. Configure it in `knip.jsonc`:

- Add an entry point when code is loaded by path instead of imported. Examples are webview entries passed to `packageAsset()`, fixtures that tests spawn, and files named in build configs.
- Add an `ignoreDependencies` entry only when a dependency is used where knip cannot see it, and write a comment that names the user. For example, the workbench build inlines `pstdio-extensions` and `pstdio-api-contracts`, so its `dist` imports their `rimless` and `zod` dependencies.

## Coverage

`bun run test:coverage` runs every package's `test:coverage` script with an lcov reporter. Packages and first-party extensions with tests define a `test:coverage` script. It uses the same conditions and runner as the package's `test` script. Run one with `bun run --cwd <package-or-extension> test:coverage`. Build the monorepo first, because this command does not build dependencies.

The README coverage badge uses the full nightly validation's stable P0–P2 source tests. Existing Bun jobs collect lcov alongside their case evidence; they do not run again for coverage. Linux and Windows reports use repository-relative source paths, so imported line hits merge across jobs and platforms. P3 benchmarks stay uninstrumented. Quarantine cases do not contribute to the source percentage.

The nightly `source_coverage` job requires every selected source producer's artifact from the current attempt, including hidden extension paths. It rejects stale revisions, partial executions and missing measurements, then writes `coverage.json` and `coverage-report.json`. The Coverage workflow publishes those files to `badges` only after the complete nightly Release Packages workflow succeeds. It runs no tests. Its manual dispatch takes a successful nightly run ID and fails if that run has no unexpired measurement. The report records the source workflow run so an older nightly cannot replace a newer published measurement. Reporting tests are ordinary P0 tests selected by the main CI workflow.

For a source-only rehearsal, manually dispatch Test and Build with profile `production` and release channel `nightly`. This measures coverage and validates the nightly platform policy without publishing a release. Local `bun run test:coverage` and `bun run --cwd scripts coverage:badge -- <path>` remain available for package diagnostics; they do not replace the official nightly measurement.

The report records the checked-out Git revision, measurement time and `COVERAGE_SCOPE`. It lists tracked production TypeScript files absent from the imported-file denominator separately; their executable-line counts are unknown. Generated files, declarations, stories, test helpers and fixture packages do not contribute to the denominator. Browser and compiled execution are separate evidence and never become source percentages.

Set `COVERAGE_EXECUTION_REPORT` to a JSON array of execution evidence when attaching stage and platform completion. Each entry records `revision`, `stage`, `platform`, `priority`, `quarantined`, `selectedCaseIds` and `cases` with `id` and `outcome`. Missing, duplicate, unexpected or wrong-revision cases make that entry incomplete. Quarantined entries remain separate. Without this input, the report explicitly says execution evidence was not provided.

The shared test preload owns its temporary home until the global `afterAll` hook, after every test file. Individual tests must close app handles, subscriptions and child processes in `finally` blocks or register `onTestFinished` cleanup as soon as a fixture opens. Caller-provided storage belongs to the caller. Copy requested failure evidence into its retained artifact location before disposing fixtures. Tests that change `process.env` run serially; the preload restores the environment after each test. The API per-file process driver remains required by [ADR 0018](../../adrs/0018-temporary-api-test-process-isolation.md).

Packaged Playwright specs and benchmarks import `test` from `src/scripts/playwright-test.ts`. Its automatic fixture cancels pending command, readiness, and shutdown waits after a timeout. Biome rejects direct imports of Playwright's base `test` in these files, so new browser tests keep the same cleanup.

A package's report also lists source files from the packages its tests import. The script merges line hits per file, so each source file counts once. It leaves out tests, stories, fixtures, mocks, test helpers, dependencies, build output, and files outside the repository. Bun reports only files that a test loads, so files that no test imports are missing from the total. Bun's lcov output has no function names, so function coverage cannot be merged and the badge shows lines only.

## CI stages

[CI stages](0015-ci-stages.md) describes what runs on pull requests, in the merge queue, on `main`, in the nightly and in a stable release, and what to do when a PR leaves the queue. It also covers failure handling, evidence, build caches and release certification.

Windows unit jobs divide the complete P0/P1/P2 file set into four shards before grouping files by owner. Each owner runs only its assigned files. Package scripts must not add a broad `src` selector, because Bun combines that selector with the assigned paths and repeats other shards' tests. The existing 15-second test allowance remains unchanged; Git worktree tests keep their existing 30-second allowance.

The Merge queue removals workflow retains first-failure links and the `removed-from-queue` label. Repair the cause before requeuing. Weekly CI failure reports retain first-attempt scheduling, setup, build, test, reporting and cleanup evidence; a later passing rerun does not resolve the underlying failure.

## macOS release checks

Signed macOS builds submit the app with native `notarytool` from Forge's `postPackage` hook. Submission and ticket retrieval are separate operations. After Apple accepts the upload, `stapler staple` gets up to three attempts for Apple network failures: exit code 68 with `NSURLErrorDomain` in the output. The pauses are one and two seconds. Release verification uses the same rule for `stapler validate`.

Every attempt logs its status and output. Other errors fail at once. This retries an external service call; test retries remain disabled. Validate a change to this path with a full stable release candidate that builds, notarizes, staples, and verifies both macOS targets. Nightly runs cover Apple Silicon only.

## Published extension dependencies

Run `bun run --cwd scripts verify:published-extensions` to typecheck and test every extension in the Changesets release group against the registry SDK and UI versions selected by its dependency ranges. The check copies each extension outside the workspace, installs fresh dependencies, runs `bun check`, and runs its Bun tests. It preserves shared compiler settings and test isolation, but copies no workspace packages, installed dependencies, or lockfiles. Failures name the extension and command; output shows the resolved SDK and UI versions.

Published-extension checks and public-package consumer checks use a one-day minimum release age for fresh installs. This keeps a third-party publish in progress from selecting packages whose matching dependencies are not available yet. Prompt Studio packages in the Changesets release group are exempt, so these checks can use the SDK and UI immediately after a release. The repository's frozen-lockfile install is unchanged. See [Bun's minimum release age](https://bun.sh/docs/pm/cli/install#minimum-release-age).

Keep the Storybook development tools in Artifacts, Base Themes and Planner pinned to the same tested release. A fresh install must not select a newly eligible Storybook parent while its exact-version companion packages are still inside the age window. Update the tools and their extension lockfiles together; keep the one-day policy.

On pull requests, the CI job runs for selected extension, SDK, UI, API contract, and shared-tooling code changes. Complete queue and production functional profiles include it. Repo-local packages outside the release group and extensions using `workspace:` SDK dependencies are excluded. The network check stays separate from local `bun run validate`.

## Extension smoke checks

The user-facing `pst extensions test` command is described in [Smoke checks](../extensions/0006-smoke-checks.md). To check its packaged behavior in this repository, build dashboard assets first, run the affected package's tests and checks, then `bun run --cwd scripts verify:packages`. Packaged consumer fixtures exercise passing views, startup exceptions, capability denials caught by guest code, forged host diagnostics, fixed main panels, and browser setup without external JavaScript runtimes. For interactive dashboard validation use `bun run dev:playwright` and stop it with `bun run dev:playwright:down`. These contributor commands are not prerequisites for installed CLI users.

`pst extensions pack` is a local file operation. Its archive tests require that packing starts no runtime, then check reproducibility, installation, upgrades and directory cleanup. A live runtime retaining archive-fixture files is an ownership failure; filesystem retries cannot repair it.

The interruption fixture holds a webview's HTTP request open before sending real Ctrl+C through the terminal. It requires interruption status 130, runtime exit, descriptor removal and successful reopening of the retained Chromium profile. A phase message alone does not prove the operation is still active. On Windows, direct process termination bypasses signal handlers, so it cannot test graceful interruption.

Package verification provisions Chromium through the compiled CLI before starting the timed tests, including on Windows x64. The install test reuses the browser and package caches while checking a fresh caller directory with no external JavaScript runtimes. Cold downloads remain subject to the existing CI job limit instead of the runtime test's 30-second deadline. The compiled bundle leaves out Playwright's optional BiDi modules; see [ADR 0029](../../adrs/0029-temporary-chromium-only-playwright-bundle.md).

`pst extensions install-browser` installs full Chromium without Playwright's separate headless shell (`--no-shell`), and `pst extensions test` launches that browser. Packaged tests launch the same browser with `PROVISIONED_CHROMIUM` from `packages/e2e/src/packaged/packaged-chromium.ts`, which selects Playwright's `chromium` channel. A plain `chromium.launch()` would look for the headless shell, which a clean machine does not have. Packaged Bun dashboard functional smokes use `PACKAGED_DASHBOARD_BROWSER`: native Edge on Windows ARM and provisioned Chromium elsewhere. Windows ARM needs Edge installed; a missing browser fails the test. This temporary choice preserves every action and allowance; see [ADR 0111](../../adrs/0111-temporary-native-edge-for-windows-arm-dashboard-smokes.md). Browser installation, lifecycle, interruption, explicit browser-matrix specs, and benchmarks keep their declared browser. Firefox and WebKit cases still need `playwright install`.

Packaged tests need a compiled binary that contains the dashboard. `buildBinary` in the tests compiles `dist/pstdio` but does not build the dashboard, so build it first. Without it, `GET /` returns 404 and browser sign-in waits until its timeout. To prove a clean environment, use a new browser folder and home:

```bash
bun run build -- --scope pstdio-dashboard --include-dependencies
bun run --cwd scripts build:host
export PLAYWRIGHT_BROWSERS_PATH="$(mktemp -d)" PSTDIO_HOME="$(mktemp -d)" E2E_PACKAGED_BINARY_PATH="$PWD/dist/pstdio"
dist/pstdio extensions install-browser
cd packages/e2e && bun test src/packaged/packaged-serve-helpers.p2.test.ts src/packaged/extension-browser-install.p2.test.ts
```

Copy `dist/pstdio` to a private path and point `E2E_PACKAGED_BINARY_PATH` at the copy when another task may rebuild the binary at the same time.

## Isolation

Packaged desktop update-channel and database-recovery tests use `PSTDIO_DEFAULT_EXTENSIONS=[]`. They keep real project creation, Settings and CLI checks, database ownership conflicts, damaged control files, and recovery after repair. These host checks do not use an agent harness. Navigation customization keeps its workbench fixture extension configuration across relaunches. Cold default-extension installation remains covered by `packages/e2e/src/packaged/packaged-core-extensions-smoke.p1.test.ts`, which runs in the native packaged toolchain checks, including Windows, with its existing workload and allowance. Attached backend-recovery tests keep their existing cold extension setup.

When an assertion waits for child-process or socket output, await the operation before asserting on its result or captured error. Bun's `expect(promise).rejects` and `.resolves` can synchronously drive a nested event loop and block Windows I/O callbacks. See [the pipe-read lesson](../../lessons-learned/0016-bun-expect-rejects-blocks-pipe-reads.md) for the safe rejection pattern.

Bun tests preload `scripts/test-setup.ts`. It removes inherited `PSTDIO_*` runtime settings, creates a temporary home, and restores the environment around each test. Tests that need runtime settings must supply them inside their setup or to the process they start. Do not run tests that mutate `process.env` concurrently in one process.

The local workspace registry caches only completed, successful published metadata. Each client owns its pending upstream request, which is cancelled when that client disconnects. A failed or abandoned request must not leave another installer waiting on the same lookup. Packaged core-default fixtures retain setup logs under `packages/e2e/test-results/packaged-core-extensions`, outside the disposable runtime home, so timeout artifacts show the last active install phase.

Windows CI passes `--timeout=15000` to its Bun test commands, including package scripts run through Lerna. Tests and lifecycle hooks get a 15 s default. Explicit test limits and custom runners retain their own limits. Other CI platforms retain their existing defaults. This temporary allowance accounts for hosted Windows runner variance; ADR 0044 records the evidence and removal criteria.

The UI and Vite launchers also remove inherited runtime settings. Each run allocates loopback ports and uses an isolated home and in-memory database. Test controls use the `E2E_` prefix:

- `E2E_PACKAGED_BINARY_PATH` selects an already built binary for packaged tests. The package verifier sets it to the host-compatible release artifact.
- `E2E_REQUIRE_WEBVIEW_BROWSERS=1` makes missing packaged-test browsers fail instead of skip. CI sets it.
- `E2E_BUN_CACHE_DIR` chooses the runtime install cache. Without it, UI runs use a cache per run.
- `E2E_RUN_ID` selects the UI and Vite report directory.

The packaged Planner runtime spec (`packages/e2e/src/packaged/packaged-planner-runtime.p2.spec.ts`) installs the current Planner into a running host and seeds populated projects. It covers saved views, filter controls, Track conflicts, missing caches, and webview reload recovery. The install downloads the Planner's locked dependencies into the test home.

Packaged relay checks cover shared-document replication, project sync states, encrypted uploads, and device-local record persistence. Record replication is paused until per-resource sync exists, as specified by [ADR 0100](../../adrs/0100-one-document-per-resource.md). These checks still run automatically.

CI separates packaged CLI, packaged browser and Vite terminal contracts by priority. Queue rows select P1; production adds P2. Each row retains its existing execution allowance and does not wait for another suite to finish.

Packaged collection benchmarks run in P3 separately from functional tests. Their existing operation budget, workload, samples and execution allowance remain unchanged. `test:packaged` still includes the benchmark for an explicit full packaged run.

Nx test, conformance, and coverage targets do not cache passing results. Every CI attempt executes the tests. Dependency and build caches remain enabled, including build dependencies of test targets. Do not use a global cache-bypass flag: it also repeats dependency builds.

Global preferences survive project deletion. Browser specs that read or change notifications use the test fixture in `src/ui/helpers/notification-settings.ts` and opt in with `test.use({ notificationsEnabled: true })` when needed. The fixture restores the previous preference during teardown.

Packaged desktop specs import `test` from `clients/desktop/src/testing/packaged-fixture.ts`. The fixture owns launched process groups and temporary homes. Its teardown runs after a test timeout, even when an unfinished CDP operation prevents the test body from reaching its own cleanup.

Compiled builds generate an empty application database image with the installed PGlite version and current Drizzle migrations. The image holds only `template1`, the database the runtime opens; it leaves out the unused `postgres` and `template0` databases because a first start must write every image file, which is slow on Windows. New, empty database directories load that image, including its migration history. The runtime unpacks the image into `pstdio.db.restoring` beside the data folder, then moves the finished folder into place. A start that stops while unpacking leaves the data folder empty, so the next start unpacks the image again. The normal migrator still runs, so later schema changes follow the same upgrade path. Nonempty directories always open their existing files, including damaged databases that need recovery. This moves PostgreSQL initialization and fresh schema creation into the build and reduces cold startup. PGlite documents this approach in its [pre-populated filesystem guide](https://pglite.dev/docs/prepopulatedfs).

Use the pinned Bun 1.4.4 toolchain for installs and compiled builds. Bun 1.3.14 can reject a valid large tarball when its first network chunk is shorter than the gzip header. This caused intermittent PGlite installation failures on macOS. The [upstream extraction fix](https://github.com/oven-sh/bun/pull/34861) is included since 1.4.2. CI and Docker builds use the same version. The landing-page builder also provides Node 24 for Astro and Vite, matching their runtime in regular CI builds; Bun manages dependencies and runs the package scripts.

Tests install local fixture extensions from `packages/e2e/src/default-extensions.ts`. Select `pstdio.workbench-fixture.harness.fake` for ordinary session tests. A Planner attempt starts a session; `startSession: false` is not a supported command parameter. Tests for a real provider must supply a controlled executable or explicitly opt into live integration tests.

## Browser coverage and failures

Playwright uses one worker and no retries. CI rejects focused Playwright tests (`test.only`). UI and Vite traces are recorded on the first run and retained on failure. This follows [Playwright's trace modes](https://playwright.dev/docs/test-use-options#recording-options).

Queue CI runs CLI contracts and up to two P1 app browser shards independently. Production adds up to six P2 app shards. Component owner/priority rows build and run independently in `packages/storybook-tests`. Each app shard has its own runtime, home, and database. Files stay intact and use one worker, so ordered tests share no state across runners. Docker build breadth runs in production. Both images copy the root Bun configuration and every workspace manifest so frozen installs use the same workspace graph and linking rules as the checkout. Local extension source stays outside the build context.

Evidence artifact names end in `-attempt-<run_attempt>` so a manual rerun keeps the earlier evidence. UI shards upload `ui-e2e-results-<shard>-attempt-<run_attempt>`; packaged/Vite uploads `packaged-vite-e2e-<suite>-results-attempt-<run_attempt>`. Component rows upload `component-results-<owner>-<priority>-attempt-<run_attempt>`. Desktop test rows upload `desktop-test-results-<target>-attempt-<run_attempt>`; release rows upload `test-results-desktop-<target>-attempt-<run_attempt>`. Windows update checks upload `windows-installation-readiness-attempt-<run_attempt>`. Native toolchain checks upload `packaged-toolchain-<platform_pkg>-attempt-<run_attempt>` with test results and traces. Their timestamped build and verification output remains in the GitHub job log.

Packaged toolchain checks run through the CI runner with direct arguments and the operating system's default shell. Do not wrap Windows verification in a Git Bash pipeline: it gives child processes an inherited Ctrl+C-ignore attribute, preventing the real terminal interruption check from exercising normal Windows signal handling.

Windows packaged-toolchain CI opts into a ReFS Dev Drive owned by the job and sets `TEMP` and `TMP` to a folder on it. Other Windows jobs keep `TEMP` and `TMP` on `RUNNER_TEMP`, preserving their existing database and detached-process fixtures. The opt-in puts cold packaged runtime homes and install caches on storage that writes many small files quickly. Every fixture still creates a fresh home and cache, and cleanup stays inside its existing test allowance. On the `C:` system volume, the only volume on Windows ARM64 runners, cold extension installs exceed that allowance. [ADR 0114](../../adrs/0114-temporary-windows-ci-job-temp-directory.md) records the temporary storage override and its removal check.

App reports and traces are under `packages/e2e/playwright-report` and `packages/e2e/test-results`; component reports use those folder names under `packages/storybook-tests`. Desktop results are under `clients/desktop/test-results`. Each packaged test home attaches complete redacted copies of `logs.jsonl` and `desktop-runtime.log` as files before removal. Startup errors include the last 50 runtime output lines. Electron traces start before the lifecycle-page wait, after the sidecar startup wait has protected process isolation; an unavailable attachment states why a trace could not start or be saved. Missing evidence warns without replacing the original build or test failure.

Linux UI, CLI, and packaged/Vite jobs use the official `mcr.microsoft.com/playwright:v1.60.0-noble` image. They run as user 1001, matching the owner of GitHub's mounted home directory; Firefox rejects a root process using that user's home. The image includes browser binaries and system libraries, so these jobs do not install Ubuntu packages or browsers during setup. Keep the image version aligned with the installed Playwright version when updating dependencies. Desktop jobs still run on their native Linux and macOS runners.

The browser container installs the root manifest's Bun version with `scripts/ci/setup-container-bun.ts`. This temporary bootstrap uses Bun's official registry archive because the normal setup action requires `unzip`, which the image lacks. ADR 0026 describes when to remove it.

Obsolete dashboard specs were removed. Current tests cover project selection, ticket workflows, session follow-ups, workspace files and terminals, extension lifecycle, and workbench navigation. Add coverage for restored features against the current UI. Live Claude, Codex, and OpenCode follow-up tests skip unless `E2E_AGENTS` selects the provider. Packaged browser checks cover Chromium, Firefox, and WebKit; the main UI suite covers Chromium. The packaged webview suite gives commands/settings, workspace panels/session tabs, and documents/collections independent cold fixtures and test results. It keeps every assertion and the existing 120-second per-test allowance.

### Flaky-test quarantine and reliability runs

`scripts/ci/test-quarantine.json` records confirmed flakes, their affected platforms, owners, first-failure evidence, and removal criteria. The shared Bun wrapper, API file driver, and packaged Bun/Playwright runners exclude only registered cases on the listed platform. CI executes them separately in quarantine steps, without retries or changed limits. Only the registered test steps allow failures; setup and build failures remain blocking. A separate report check requires every registered case to execute exactly once and records its failure count in the job summary. Missing reports, skipped cases and retries fail that check. Bun JUnit reports, packaged browser JSON reports, and traces are uploaded with attempt-specific names. A passing stable gate does not mean that quarantine passed. [ADR 0101](../../adrs/0101-temporary-flaky-test-quarantine.md) records the temporary trade-off.

Database coverage uses the same stable selection. Quarantined cases do not contribute to its line-coverage report; their separate lane owns their execution evidence.

The Apple Silicon desktop row runs its registered packaged cases in a separate step against the same built app. The normal desktop suite retains the project-tab lifecycle case on Linux, Windows and Intel macOS. `E2E_TEST_LANE=quarantine bun run --cwd clients/desktop test:packaged` selects the registered cases on an affected native machine. The separate report check remains required and uploads beside the stable desktop results.

Run registered cases locally with `E2E_TEST_LANE=quarantine bun run --cwd packages/pstdio-db test`, `E2E_TEST_LANE=quarantine bun run --cwd scripts test`, or `E2E_TEST_LANE=quarantine bun run --cwd packages/e2e test:packaged:browser`. Use the normal package scripts for the stable lane. Direct `bun test <file>` remains available for diagnosis and does not apply quarantine selection.

Windows compiled CLI quarantine runs after native package verification against that same binary. For diagnosis, set `E2E_PACKAGED_BINARY_PATH` to the compiled executable and run `E2E_TEST_LANE=quarantine bun run --cwd packages/e2e test:packaged:cli`. The API quarantine step runs its registered file in an isolated source-conditions process, with the same 30-second test allowance as normal API shards.

For ten full CI validations, create ten refs under `test/ci-reliability/<batch>/` at the same final commit. Each push starts the normal full workflow, including native builds, all browser engines, package consumers, and quarantine. The ref is part of the concurrency key, so independent runs cannot cancel each other. Nx test targets disable result caching; dependency builds still use their caches. Count first attempts and record all failures. If a fix changes the commit, start a new ten-run qualification on that commit. A test passing on a later attempt does not erase its earlier failure.

To investigate a failure, keep retries disabled and repeat the affected spec:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/ticket-workflows.p2.spec.ts --repeat-each=5
```

To run one CI shard locally, use `bun run --cwd packages/e2e test:ui -- --shard=2/3`. Keep the same shard total when comparing runs.

The Marketplace install/delete/disable/enable lifecycle is manual-only. Run it explicitly with:

```bash
E2E_MANUAL_MARKETPLACE_LIFECYCLE=1 bun run --cwd packages/e2e test:ui -- src/ui/marketplace-extension-lifecycle.p1.spec.ts --grep "deletes, installs, disables, and enables a Marketplace extension"
```

Normal UI runs skip that lifecycle check. The separate extension automation toggle test still runs automatically.

App UI tests in `packages/e2e` never build or start Storybook. Component browser interactions live in the private `packages/storybook-tests` package, while story source stays beside its component. This suite starts only Storybook servers; it has no application API, database, or app web server.

Run critical component contracts with `bun test:p1 --runner component`. The command builds the selected owners and serves their static Storybooks. To run a single spec, build its owner with `bun run --cwd packages/pstdio-workbench build-storybook`, then use `STORYBOOK_PACKAGES=pstdio-workbench bun run --cwd packages/storybook-tests test:browser -- src/ui/pstdio-workbench/panel-tabs.p1.spec.ts`. Static output lives under each owner's `storybook-static` directory. Servers load a real story before tests begin, preserve story play completion waits, and keep the existing 60-second startup allowance. Reports and traces live under `packages/storybook-tests/playwright-report` and `packages/storybook-tests/test-results`.

Read the first failure and its trace. Check setup, teardown, and server logs before attributing the failure to an assertion. Storybook startup failures include the tail of the server output. Readiness checks must cancel stalled HTTP requests within their deadline.

Keep the existing job and test time limits. A timeout needs an investigation of the slow phase; see [Time limits](#time-limits). A passing rerun alone does not explain the failure.

The Windows job tests native dependency installation, relative workspace links, scoped dependency watcher events, and concurrent attachment reads before building. After building the SDK dependencies, command discovery tests exercise real process launches with PATH overrides, PATHEXT order, PowerShell siblings, explicit wrapper paths, custom npm prefixes, spaces, Unicode, shell operators, conflicting installations, missing targets, and timeout cleanup. npm fixtures use the pinned `cmd-shim` generator and check both adjacent Node and PATH fallback. Argument round trips include literal percent signs, exclamation marks, and variable-like strings with values present in the child environment. Environment tests cover Windows case-insensitive names without passing host secrets to extensions. The same portable cases run on Linux.

`harness-npm-detection.p2.test.ts` runs the compiled runtime with deterministic OpenCode, Codex, and Claude Code CLI fixtures. It checks detection, versions written to stderr or with terminal colors, a healthy harness alongside failed and hanging probes, project extension filtering, and OpenCode model discovery. It changes installations for the same project and checks discovery again after the availability cache expires. Model requests for all three harnesses must return empty lists when version probes hang, and their child processes must exit. The runtime parent stays alive, and repaired commands must recover detection and model listing in the same runtime after the existing cache expires. The version-probe deadline applies to model listing as well as availability checks. No provider accounts, API keys, or live agent services are required. Harness changes receive affected fast checks; the queue retains Linux/macOS integrity. Windows npm detection and the full native matrix run in production functional validation. Add `ci:full` to request separate full functional diagnostics for an internal PR. Keep these tests within the existing CI time limits.

These tests simulate different inherited environments. Real Explorer/login PATH refresh, PowerShell aliases, WSL-only installations, and organization-managed execution policies still need targeted manual checks. Codex and Claude model/session protocols and OpenCode server startup use separate launch paths; this discovery suite does not establish their Windows compatibility. Those paths need dedicated protocol fixtures before changing their launch behavior.

The npm `cmd-shim@7.0.0` batch wrapper assigns its installation directory without quotes. A prefix containing `&` truncates that directory and fails even when the wrapper runs directly under `cmd.exe`. A native regression checks this failure outside the process API and confirms the API reports the failure too. The healthy npm fixtures use spaces and Unicode; a separate controlled wrapper checks our launcher with `&` in its directory.

Readable attachments share their stored bytes through hard links and are removed with the file or project storage. Cover both scoped packages and linked `node_modules` directories, as extension installation uses both. Each Windows database/API shard runs only one package to avoid competing database startups on the same runner. The API suite uses two file workers, then runs `process-discovery.p1.test.ts` alone in its assigned shard so PowerShell startup does not compete with a PGlite cold start. The runner logs when that file starts alone. The separate Windows npm shim check still runs it too.

Non-recursive watcher tests remove dependency trees from another process while refreshing watches, then check that later package changes still refresh the source. This covers directory removal during a filesystem read.

## Chat rendering measurements

The **Patterns/Chat/Chat Panel Streaming Ready** story opens an overflowing conversation while paragraphs arrive on every animation frame. Its play check requires the transcript to appear before the stream stops. Initial tail readiness owns one settling window per conversation mount; streamed layout changes update its DOM measurements without restarting that window. Use Chromium CPU throttling to inspect this case on a slow renderer.

Use the **Patterns/Chat/Chat Panel Rendering** Storybook stories to inspect long turns. `RenderingWorkloads` starts with an empty chat and prepares fixtures before the measured mount. `LongTurnScrolling` checks bounded responses, sticky user context, expansion, scrolling, hidden-page recovery, session switching, and tail following during streaming. `ContinuousScrolling` checks the sticky message on each animation frame while scrolling up and down within one large response. A check that waits for scrolling to settle does not cover this behavior.

The fixed workloads in `packages/ui/src/components/chat-ui/performance/chat-rendering-fixtures.ts` are:

- Rich turns: 500 turns and 1,000 messages, with four Markdown repetitions and three tools per turn.
- Plain turns: the same message roles and count, with short text only.
- Long turns: one rich user message followed by 1,000 or 5,000 rich responses. Each response has one Markdown repetition, reasoning, and three tools.
- Large response: one user message and one response containing 100 repetitions of rich Markdown.

Run `CPU_THROTTLE=1 bun run --cwd packages/ui perf:chat -- chat-rendering.p3.perf.ts` for native Chromium measurements. Repeat with `CPU_THROTTLE=4` for throttled measurements. The existing config runs each workload three times in fresh contexts. Record viewport size, browser version, hardware, commit, and any competing work. Compare the same fixtures and settings before and after a change; report medians and ranges rather than one sample.

The measurement excludes module loading, fixture construction, API requests, and database work. It measures mount, scrolling to the middle, session switching, and streaming one response in 384-character chunks. Readiness requires a visible chat viewport and three animation frames. Each phase attaches a CPU profile, script/layout/style/task times, long tasks, and mounted row/editor/table/DOM counts to the Playwright report. These component timings are not end-to-end session-opening timings. A stopped or timed-out measurement is incomplete, not a performance result. Existing budgets and execution allowances remain unchanged.

The shared chat list virtualizes each user message and response independently with four rows of overscan. It also retains the user row for the visible turn. A native CSS sticky element follows scrolling inside a wrapper bounded by the turn's measured height; its position does not depend on React rendering each scroll offset. Logical turns still determine sticky context, question visibility, and final-response actions; their length does not determine mounted response count. Markdown display imports only changed content and installs editing plugins and source tracking only when editable. Rich messages still use Lexical for selection, copying, links, highlighting, and rich nodes.

The viewport preserves its visible pixel offset across hiding and resumes tail following when appropriate. The scroll library's hidden-element limitation and the isolated restoration hook are recorded in [Temporary hidden conversation scroll restoration](../../adrs/0075-temporary-hidden-conversation-scroll-restoration.md).

This boundary bounds the number of mounted messages, not the size of one message. A large response, an expanded user message, or a merged reasoning/tool timeline still mounts all its content. Parsing, node creation, and layout therefore scale with that content. Measure this limit separately rather than splitting the benchmark input or hiding rich content to make a budget pass.

## Time limits

Tests have two kinds of time limit. [ADR 0067](../../adrs/0067-separate-performance-budgets-from-execution-allowances.md) records the decision.

- A **performance budget** limits one named product operation with a fixed workload. A benchmark owns it and defines the scenario, workload, measured process, start and end events, and unit. Exceeding a budget is a product regression, even when the test finishes well inside its timeout.
- An **execution allowance** limits a whole test, fixture, or job. It covers setup, the operation, and cleanup. Reaching it means the work did not finish. A timed-out run gives a lower bound, not a measured duration.

Functional tests do not assert timings. Benchmarks do not measure test-only setup, tracing, or cleanup, but they include initialization a person waits for, such as macOS checks on the first launch of a signed app. Helpers wait within the deadline of the test that calls them. Do not add a shorter cap inside a helper; it can end a slow but valid phase before the test can report it. Keep prompt failures for real errors, such as a process that exits.

The database package's `test` and `test:coverage` tasks declare Nx `parallelism: false`. Nx runs each without competing package tasks from the same invocation. The export-worker check starts both real database engines within its existing allowance; concurrent package work can starve that setup. Other package tasks keep their normal concurrency. `NX_PARALLEL` alone does not limit Lerna's explicit package concurrency.

The subnav benchmark measures trusted clicks and request completion in the browser's monotonic clock. Match every observed request to its [Resource Timing](https://www.w3.org/TR/resource-timing/) entry, including repeated URLs. Missing or ambiguous timing fails the measurement. Do not subtract browser `performance.timeOrigin` from protocol wall-clock timestamps: those clocks can disagree and report minutes for a request the browser completed in milliseconds. Network observation still verifies quiescence, response status, content and all linked sessions.

To review a timeout:

1. Find the slow phase: dependency setup, app readiness, the operation, cleanup, reporting, or the whole job. Playwright steps and benchmark attachments show phase timings.
2. Check for hangs, leaked processes, blocked event loops, and expensive setup first.
3. Collect timings from representative local runs with the same workload and build mode as CI. Include cold setup when the test needs it.
4. Inspect several runs on each applicable CI platform, including slow successes and failures. Keep local and CI timings separate; do not average different environments. Record the revision, command, OS and architecture, runner, and cold or warm state.
5. Propose an exact value that covers the slowest legitimate phase with stated headroom. Use platform-specific values only when the evidence shows different work. When relevant local or CI evidence is missing, say so and collect it first.
6. Get approval for that exact value (see AGENTS.md), then verify it locally and in the affected CI jobs. Check that a never-ready case still fails and cleanup still completes.

When tests are added, review the job allowance or sharding. Do not lengthen the per-test limit because a suite has more tests.

Hosted Intel macOS runners run the packaged and desktop suites two to three times slower than other platforms, and one Intel run can take twice as long as another. Every Intel suite therefore allows 60 seconds per test: the desktop Playwright suites (approved on 2026-10-10, together with Windows) and the packaged CLI suite, whose limit `packages/e2e/src/packaged/packaged-test-timeout.ts` sets and `run-packaged-cli-tests.ts` passes to `bun test --timeout` (approved on 2026-10-12, after tests that pass in 11 to 23 seconds on Intel timed out at 30 seconds on a slow runner). Other platforms keep 30 seconds. Tests that set their own longer limit keep it.

On 2026-10-28 the user approved a 60-second Windows allowance for two packaged cases: Planner board panning and three-host extension synchronization. In [release run 40688319361](https://github.com/pufflyai/prompt-studio/actions/runs/40688319361), the ARM64 board case reached edge-scrolling verification at 29.48 seconds and timed out at 30 seconds; the x64 three-host case also reached its 30-second limit. These named allowances cover setup, behavior checks and cleanup. Other platforms, other cases and performance budgets retain their existing limits. P2 browser workloads use twelve shards and retain the 18-minute job allowance.

## Desktop benchmarks

The [nonfunctional requirements](../../../NONFUNCTIONAL_REQUIREMENTS.md) describe advisory targets, including a 2-second M5 cold start and 1 GB average memory. Regular performance coverage runs in nightly CI and stable-release validation. Agents **SHOULD** run relevant benchmarks locally when they expect significant performance impact from a change. The existing CI budgets below use hosted hardware and a visible-workbench milestone; dedicated M5, aggregate-download, and average-memory checks are not implemented yet.

Every benchmark, including these, also reports to the shared result format that the Benchmarks workflow and the Performance pages use. See [Benchmark results](../../references/performance/0006-benchmark-results.md).

Desktop budgets live in `clients/desktop/src/e2e/*.bench.ts`. Run them against a packaged app:

```bash
bun run --cwd clients/desktop package
bun run --cwd clients/desktop test:benchmark
```

The release workflow runs them in a separate step before the functional packaged suite. One worker runs files in name order and tests in declaration order. Intel macOS runs only the benchmark tagged `@essential`, the cold start, so it measures the first launch of the freshly signed app, including macOS launch checks. Other platforms run the cold start after the warm-attach and recovery launches. Before benchmarks were separated, it ran after two other packaged launches there too, so their budgets do not cover first-launch checks. The functional packaged suite and package checks still run after a benchmark failure, and the job still fails. The Windows signing workflow runs the benchmarks the same way. Benchmarks run without Electron traces, because trace screenshots and DOM snapshots add renderer work. Use the traced functional suite or a separate profile to diagnose a failure.

Each benchmark attaches `benchmark-<name>.json` before checking its budgets. It records the scenario, workload, measured process, start and end events, every metric with its unit and budget, the source revision, the sidecar checksum, and the runner. A metric must be below its budget. A missing or non-finite measurement fails the benchmark. `test-results/packaged-benchmarks.json` collects the run.

| Benchmark | Measured interval | Budget |
| --- | --- | --- |
| Cold start (empty home) | Process spawn to visible workbench root; process spawn to visible startup window | 8 s cold start (10 s on Windows, 28 s on Intel macOS); startup window 1.5 s on macOS (10 s on Intel), 1 s on Linux and Windows |
| Warm attach | Process spawn against a persistent runtime with one open project to visible workbench root; startup window as above | 3 s; startup window as above |
| Sidecar crash recovery | Runtime kill to visible recovery heading | 500 ms |
| Idle workbench, monitoring off or on | Renderer CPU share over 10 s after a 2 s settle | See the renderer table below; Electron main at most 10% of one core with monitoring on |
| Idle extension preview | Workbench and Lab renderer CPU share over 10 s after a 2 s settle | See the renderer table below |
| Long streaming replay | Renderer CPU share from submitting the replay to an already open session until the API reports completion and Step 30 is visible | See the renderer table below |

Renderer benchmarks took 10–17 seconds each on Apple Silicon, within the existing 30-second packaged test limit. Linux and Windows release runs have not been measured yet.

Renderer benchmarks read Chrome DevTools Protocol `Performance.getMetrics` deltas for each measured renderer and attach the raw counter deltas. `ScriptDuration` and `TaskDuration` are main-thread proxies. They are not OS CPU, GPU, or paint measurements. Each budget is the share of measured wall time the renderer may spend in scripts or tasks.

| Check | Window | Budget (script / task) | Apple Silicon baseline, 3 runs |
| --- | --- | --- | --- |
| Idle workbench, monitoring off | 10 s after a 2 s settle | 2% / 5% | ≤ 0.04% / ≤ 0.11% |
| Idle workbench, monitoring on | 10 s after a 2 s settle | 2% / 5% | ≤ 0.01% / ≤ 0.07% |
| Idle extension preview (workbench and Lab frame) | 10 s after a 2 s settle | 2% / 5% each | ≤ 0.05% / ≤ 0.15% |
| Long streaming replay | about 6 s, until the session completes | 85% / 120% | 28–38% / 51–68% |

The idle budgets catch a constant render or polling loop. On 2026-10-10 the release rehearsals measured the streaming replay at up to 69% script and 99% task time on Apple Silicon, Linux, and Windows runners. The user approved budgets about 20% above those values. A task budget above 100% no longer limits anything, so script time is the remaining streaming guard.

The idle benchmarks turn monitoring on and off through the Settings switch, so the dashboard's slow-frame observer and frame counter run during the monitoring-on measurements. Monitoring itself runs in Electron main, which renderer metrics cannot see, so the monitoring-on benchmark also records the main process share from the snapshot. On Apple Silicon it measured 0.1–0.8% while idle with monitoring on.

`clients/desktop/src/e2e/packaged-performance-monitoring.p2.spec.ts` covers the monitoring feature without budgets. A reload test forces a 120 ms frame before and after reloading the workbench and requires both to reach the snapshot. An extension process test opens the fixture's Lab webview and requires a process that hosts only that extension, separate from the workbench process. It then pauses the extension from the status bar popover and requires the snapshot to list it in `pausedExtensionIds` and no process to host its frames. A snapshot test reads the snapshot through the preload and through `pst performance` to prove that a person and an agent receive the same measurements, then checks that turning monitoring off stops the endpoint.

The fake agent replays the long conversation when a prompt contains `__fake_long_stream__`: 30 assistant turns, 8 text updates each at 25 ms intervals, and one tool result per turn.

The streaming benchmark opens an empty session before submitting that prompt. Its counter interval covers the full replay, including the last rendered turn. It does not wait for Step 1 to be visible: auto-follow can move that row out of view before an assertion sees it.

`packages/e2e/src/ui/performance-monitoring.p2.spec.ts` covers the same feature in a browser tab. It turns on the Settings switch and checks that the status bar meter appears. It opens the popover, which shows the desktop-only CPU note and lists the fixture extension's open view. It pauses the extension, checks the placeholder, and resumes it. Last, it checks that the switch survives a reload and that **Show performance** opens the setting while monitoring is off. This spec has no time budget.

## Live provider tests

These commands opt into real agent sessions:

```bash
E2E_AGENTS=claude-code bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-completion-claude.p2.spec.ts
E2E_AGENTS=opencode bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-ordering-opencode.p2.spec.ts
```

They require the selected provider and its credentials. They are separate from ordinary fixture-based CI coverage.
