# Tests

## Validation

Use Bun 1.4.2 and Node 24, matching CI. Install dependencies with `bun install --frozen-lockfile`. The root pins `node-gyp` so native addon install scripts use the local build tool instead of a temporary `bunx node-gyp@latest` download.

When upgrading Bun, align the root `packageManager` pin, Bun engine requirements, all `@types/bun` dependencies, the lockfile, and every Docker image, including `infra/local/Dockerfile`. Update the local Bun executable and current setup documentation to the same version before validating.

Native CI installs use `scripts/ci/install-native-dependencies.ts`. On Linux and macOS it gives node-gyp the headers already installed with Node. This removes another download from native addon builds. The setting applies only to dependency installation; Electron packaging selects the headers for Electron separately.

Choose checks that cover the changed behavior and its affected callers. Start with one test file or one end-to-end spec. Run a package's tests, lint, type checks, or build when that is the smallest useful scope. After a failure, rerun only failed or affected checks. Do not repeat passing checks without a new change or unresolved concern.

Documentation-only changes need content, link, path, and formatting checks. A documentation path in a source comment, prompt, or test fixture does not by itself require application tests.

```bash
bun test <path-to-test> # from the owning package directory
bun run --cwd packages/<name> test
bun run --cwd packages/<name> lint
bun run --cwd packages/e2e test:ui -- src/ui/<name>.spec.ts
```

Build the affected package's dependencies first when its checks load compiled exports. Changes to packaged runtime behavior, assets, or file inclusion also require the packaged checks described in `AGENTS.md`. Documentation-reference-only edits do not.

Do not run full repository or full end-to-end suites unless the user explicitly requests full validation. For that case, `bun run validate` checks changesets, the lockfile, formatting, package boundaries, extension API versions, and the extension API report, then builds before translation checks, lint, and tests. `bun run test` runs package tests through Lerna followed by the E2E script, CLI, UI, and Vite terminal suites. Packaged and desktop tests run separately in CI.

Install browser dependencies before running browser tests:

```bash
bun run --cwd packages/e2e playwright install --with-deps chromium firefox webkit
```

For manual app validation, use `bun run dev:playwright`, open the printed dashboard URL, and stop it with `bun run dev:playwright:down`. Do not start a development server directly or use the developer database.

## Unused code

`bun run knip` reports unused files, exports, and dependencies across the workspace. CI runs it in the Linux job, so a pull request fails when it leaves dead code or an unused dependency behind. Configure it in `knip.jsonc`:

- Add an entry point when code is loaded by path instead of imported. Examples are webview entries passed to `packageAsset()`, fixtures that tests spawn, and files named in build configs.
- Add an `ignoreDependencies` entry only when a dependency is used where knip cannot see it, and write a comment that names the user. For example, the workbench build inlines `pstdio-extensions` and `pstdio-api-contracts`, so its `dist` imports their `rimless` and `zod` dependencies.

## Coverage

`bun run test:coverage` runs every package's `test:coverage` script with an lcov reporter. Packages and first-party extensions with tests define a `test:coverage` script. Run one with `bun run --cwd <package-or-extension> test:coverage`.

## Pull request and main runs

Test and Build runs on every pull request update: opening, reopening, and each new push. The `main` ruleset requires its `ci_passed` check before a pull request can merge. A newer push to the same pull request cancels the older run.

Pull requests run only what their changes need. The `scope` job runs `scripts/ci/pull-request-ci-scope.ts`, which compares the merge commit with the target branch:

- The Linux job always builds everything. It lints and tests only changed packages and the packages that depend on them.
- The Windows jobs run when a package that does filesystem or process work is affected, such as `pstdio-db`, `pstdio-api`, or `pstdio-wt`. A change to one of their dependencies counts. The script lists these packages. Database and API tests run on a separate runner because their PGlite setup dominates the serial test time. The platform job builds and lints every affected package, tests the remaining packages, and runs the Git worktree suite. Both jobs retain the 25-minute limit and are required by `ci_passed`.
- The e2e jobs run when the `e2e` package is affected. The extensions that e2e loads at runtime and the dashboard it serves are e2e devDependencies, so changes to them count. A test in `packages/e2e` keeps the extension list and the devDependencies in step.
- The license check runs when a `package.json` or `bun.lock` changes.
- A change under `scripts/` runs every job. It holds repository tooling, such as the test preload and build scripts.
- A change outside every workspace package runs every job, unless the file is Markdown, under `design/`, or `LICENSE`.

On a pull request, `ci_passed` accepts skipped jobs. Each push to `main` runs every job, and there `ci_passed` fails if any job fails or is skipped. A Windows or e2e failure that a pull request skipped shows up on the `main` commit that caused it. Fix it in a follow-up pull request.

## Published extension dependencies

Run `bun run --cwd scripts verify:published-extensions` to typecheck and test every extension in the Changesets release group against the registry SDK and UI versions selected by its dependency ranges. The check copies each extension outside the workspace, installs fresh dependencies, runs `tsc --noEmit`, and runs its Bun tests. It preserves shared compiler settings and test isolation, but copies no workspace packages, installed dependencies, or lockfiles. Failures name the extension and command; output shows the resolved SDK and UI versions.

The CI job runs for extension, SDK, UI, and API contract changes, and for repository tooling changes that already run all jobs. It always runs on pushes to `main`. Repo-local packages outside the release group and extensions using `workspace:` SDK dependencies are excluded. The network check stays separate from local `bun run validate`.

## Extension smoke checks

The user-facing `pst extensions test` command is described in [Smoke checks](../extensions/0006-smoke-checks.md). To check its packaged behavior in this repository, build dashboard assets first, run `bun run validate`, then `bun run --cwd scripts verify:packages`. Packaged consumer fixtures exercise passing views, startup exceptions, capability denials caught by guest code, forged host diagnostics, fixed main panels, and browser setup without external JavaScript runtimes. For interactive dashboard validation use `bun run dev:playwright` and stop it with `bun run dev:playwright:down`. These contributor commands are not prerequisites for installed CLI users.

Package verification provisions Chromium through the compiled CLI before starting the timed tests, including on Windows x64. The install test reuses the browser and package caches while checking a fresh caller directory with no external JavaScript runtimes. Cold downloads remain subject to the existing CI job limit instead of the runtime test's 30-second deadline. The compiled bundle leaves out Playwright's optional BiDi modules; see [ADR 0029](../../adrs/0029-temporary-chromium-only-playwright-bundle.md).

## Isolation

Bun tests preload `scripts/test-setup.ts`. It removes inherited `PSTDIO_*` runtime settings, creates a temporary home, and restores the environment around each test. Tests that need runtime settings must supply them inside their setup or to the process they start. Do not run tests that mutate `process.env` concurrently in one process.

Windows CI passes `--timeout=15000` to its Bun test commands, including package scripts run through Lerna. Tests and lifecycle hooks get a 15 s default. Explicit test limits and custom runners retain their own limits. Other CI platforms retain their existing defaults. This temporary allowance accounts for hosted Windows runner variance; ADR 0044 records the evidence and removal criteria.

The UI and Vite launchers also remove inherited runtime settings. Each run allocates loopback ports and uses an isolated home and in-memory database. Test controls use the `E2E_` prefix:

- `E2E_PACKAGED_BINARY_PATH` selects an already built binary for packaged tests. The package verifier sets it to the host-compatible release artifact.
- `E2E_REQUIRE_WEBVIEW_BROWSERS=1` makes missing packaged-test browsers fail instead of skip. CI sets it.
- `E2E_BUN_CACHE_DIR` chooses the runtime install cache. Without it, UI runs use a cache per run.
- `E2E_RUN_ID` selects the UI and Vite report directory.

Nx test inputs include the shared preload, root Bun configuration, lockfile, and Bun version. Changing these invalidates cached test results.

Global preferences survive project deletion. Browser specs that read or change notifications use the test fixture in `src/ui/helpers/notification-settings.ts` and opt in with `test.use({ notificationsEnabled: true })` when needed. The fixture restores the previous preference during teardown.

Packaged desktop specs import `test` from `clients/desktop/src/testing/packaged-fixture.ts`. The fixture owns launched process groups and temporary homes. Its teardown runs after a test timeout, even when an unfinished CDP operation prevents the test body from reaching its own cleanup.

Compiled builds generate an empty application database image with the installed PGlite version and current Drizzle migrations. New, empty database directories load that image, including its migration history. The normal migrator still runs, so later schema changes follow the same upgrade path. Nonempty directories always open their existing files, including damaged databases that need recovery. This moves PostgreSQL initialization and fresh schema creation into the build and reduces cold startup. PGlite documents this approach in its [pre-populated filesystem guide](https://pglite.dev/docs/prepopulatedfs).

Use the pinned Bun 1.4.2 toolchain for installs and compiled builds. Bun 1.3.14 can reject a valid large tarball when its first network chunk is shorter than the gzip header. This caused intermittent PGlite installation failures on macOS. The [upstream extraction fix](https://github.com/oven-sh/bun/pull/34861) is included in 1.4.2. CI and Docker builds use the same version. The landing-page builder also provides Node 24 for Astro and Vite, matching their runtime in regular CI builds; Bun manages dependencies and runs the package scripts.

Tests install local fixture extensions from `packages/e2e/src/default-extensions.ts`. Select `pstdio.workbench-fixture.harness.fake` for ordinary session tests. A Planner attempt starts a session; `startSession: false` is not a supported command parameter. Tests for a real provider must supply a controlled executable or explicitly opt into live integration tests.

## Browser coverage and failures

Playwright uses one worker and no retries. CI rejects focused Playwright tests (`test.only`). UI and Vite traces are recorded on the first run and retained on failure. This follows [Playwright's trace modes](https://playwright.dev/docs/test-use-options#recording-options).

CI runs CLI E2E and three browser shards in separate jobs. Each shard has its own runtime, home, and database. Files stay intact and use one worker, so ordered tests share no state across runners. Docker builds start after the Linux build and test job passes. Each UI shard uploads `ui-e2e-results-<shard>`; the packaged/Vite job uploads `packaged-vite-e2e-results`. Reports and failure artifacts are under `packages/e2e/playwright-report` and `packages/e2e/test-results`. Desktop jobs upload their own readiness results and traces.

Linux UI, CLI, and packaged/Vite jobs use the official `mcr.microsoft.com/playwright:v1.60.0-noble` image. They run as user 1001, matching the owner of GitHub's mounted home directory; Firefox rejects a root process using that user's home. The image includes browser binaries and system libraries, so these jobs do not install Ubuntu packages or browsers during setup. Keep the image version aligned with the installed Playwright version when updating dependencies. Desktop jobs still run on their native Linux and macOS runners.

The browser container installs the root manifest's Bun version with `scripts/ci/setup-container-bun.ts`. This temporary bootstrap uses Bun's official registry archive because the normal setup action requires `unzip`, which the image lacks. ADR 0026 describes when to remove it.

The UI suite has no migration quarantine list. Obsolete dashboard specs were removed. Current tests cover project selection, ticket workflows, session follow-ups, workspace files and terminals, extension lifecycle, and workbench navigation. Add coverage for restored features against the current UI. Live Claude, Codex, and OpenCode follow-up tests skip unless `E2E_AGENTS` selects the provider. Packaged browser checks cover Chromium, Firefox, and WebKit; the main UI suite covers Chromium.

To investigate a failure, keep retries disabled and repeat the affected spec:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/ticket-workflows.spec.ts --repeat-each=5
```

To run one CI shard locally, use `bun run --cwd packages/e2e test:ui -- --shard=2/3`. Keep the same shard total when comparing runs.

Read the first failure and its trace. Check setup, teardown, and server logs before attributing the failure to an assertion. Storybook startup failures include the tail of the server output. Readiness checks must cancel stalled HTTP requests within their deadline.

Keep the existing job and test time limits. A timeout needs a performance investigation. A passing rerun alone does not explain the failure.

The Windows job tests native dependency installation, relative workspace links, scoped dependency watcher events, and concurrent attachment reads before building. After building the SDK dependencies, npm command shim tests cover OpenCode version and model commands through the process API, user folders with spaces and shell operators, and forwarded arguments. The job also compiles the Windows runtime and checks OpenCode detection and model discovery through its harness using an npm-style installation with Node. Readable attachments share their stored bytes through hard links and are removed with the file or project storage. Cover both scoped packages and linked `node_modules` directories, as extension installation uses both. It runs package test suites one at a time to avoid competing database startups; the API suite still uses two file workers.

Non-recursive watcher tests remove dependency trees from another process while refreshing watches, then check that later package changes still refresh the source. This covers directory removal during a filesystem read.

## Desktop performance budgets

`clients/desktop/src/e2e/packaged-performance.spec.ts` runs with the other packaged desktop tests in the release workflow. It is not tagged `@essential`, so Intel macOS skips it. The budget tests took 10–17 seconds each on Apple Silicon, within the existing 30-second packaged test limit; Linux and Windows release runs have not been measured yet.

The tests read Chrome DevTools Protocol `Performance.getMetrics` deltas for one renderer. `ScriptDuration` and `TaskDuration` are main-thread proxies. They are not OS CPU, GPU, or paint measurements. Each budget is the share of measured wall time the renderer may spend in scripts or tasks.

| Check | Window | Budget (script / task) | Apple Silicon baseline, 3 runs |
| --- | --- | --- | --- |
| Idle workbench, monitoring off | 10 s after a 2 s settle | 2% / 5% | ≤ 0.04% / ≤ 0.11% |
| Idle workbench, monitoring on | 10 s after a 2 s settle | 2% / 5% | ≤ 0.01% / ≤ 0.07% |
| Idle extension preview (workbench and Lab frame) | 10 s after a 2 s settle | 2% / 5% each | ≤ 0.05% / ≤ 0.15% |
| Long streaming replay | about 6 s, until the session completes | 60% / 90% | 28–38% / 51–68% |

The idle budgets catch a constant render or polling loop. The streaming budget leaves room for slower hosted runners; tighten it once release runs record Linux and Windows baselines. Every test attaches its measurements with the platform, architecture, CPU model, and core count.

The tests turn monitoring on and off through the Settings switch, so the dashboard's slow-frame observer and frame counter run during the monitoring-on measurements. Monitoring itself runs in Electron main, which renderer metrics cannot see. The monitoring-on test also attaches the snapshot and requires the main process to stay at or below 10% of one core; on Apple Silicon it measured 0.1–0.8% while idle with monitoring on. A reload test forces a 120 ms frame before and after reloading the workbench and requires both to reach the snapshot. An extension process test opens the fixture's Lab webview and requires a process that hosts only that extension, separate from the workbench process. It then pauses the extension from the status bar popover and requires the snapshot to list it in `pausedExtensionIds` and no process to host its frames. The streaming test reads the snapshot through the preload and through `pst performance` to prove that a person and an agent receive the same measurements, then checks that turning monitoring off stops the endpoint.

The fake agent replays the long conversation when a prompt contains `__fake_long_stream__`: 30 assistant turns, 8 text updates each at 25 ms intervals, and one tool result per turn.

`packages/e2e/src/ui/performance-monitoring.spec.ts` covers the same feature in a browser tab. It turns on the Settings switch and checks that the status bar meter appears. It opens the popover, which shows the desktop-only CPU note and lists the fixture extension's open view. It pauses the extension, checks the placeholder, and resumes it. Last, it checks that the switch survives a reload and that **Show performance** opens the setting while monitoring is off. This spec has no time budget.

## Live provider tests

These commands opt into real agent sessions:

```bash
E2E_AGENTS=claude-code bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-completion-claude.spec.ts
E2E_AGENTS=opencode bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-ordering-opencode.spec.ts
```

They require the selected provider and its credentials. They are separate from ordinary fixture-based CI coverage.
