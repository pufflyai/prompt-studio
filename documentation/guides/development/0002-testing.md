# Tests

## Validation

Use Bun 1.4.2 and Node 24, matching CI. Install dependencies with `bun install --frozen-lockfile`. The root pins `node-gyp` so native addon install scripts use the local build tool instead of a temporary `bunx node-gyp@latest` download.

When upgrading Bun, align the root `packageManager` pin, Bun engine requirements, all `@types/bun` dependencies, the lockfile, and every Docker image, including `infra/local/Dockerfile`. Update the local Bun executable and current setup documentation to the same version before validating.

Native CI installs use `scripts/ci/install-native-dependencies.ts`. On Linux and macOS it gives node-gyp the headers already installed with Node. This removes another download from native addon builds. The setting applies only to dependency installation; Electron packaging selects the headers for Electron separately.

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
```

Run a single dashboard test through the package script, because the dashboard runner needs two flags:

```bash
bun run --cwd packages/pstdio-dashboard test -- src/workbench.test.ts
```

The script runs `bun test --conditions production --tsconfig-override tsconfig.app.json`. `--tsconfig-override tsconfig.app.json` loads the `@/*` path alias; a plain `bun test <file>` in the dashboard fails with `Cannot find module '@/...'`. `--conditions production` makes dependencies resolve their `production` export condition, as the built dashboard does. `test:coverage` uses the same flags. The dashboard imports `@pstdio/ui` and `@pstdio/workbench` from their `dist` folders, so build them first after changing them.

Build the affected package's dependencies first when its checks load compiled exports. Changes to packaged runtime behavior, assets, or file inclusion also require the packaged checks described in `AGENTS.md`. Documentation-reference-only edits do not.

Do not run full repository or full end-to-end suites unless the user explicitly requests full validation. For that case, `bun run validate` checks changesets, the lockfile, formatting, package boundaries, extension API versions, and the extension API report, then builds before translation checks, lint, and tests. `bun run test` runs package tests through Lerna followed by the E2E script, CLI, UI, and Vite terminal suites. Packaged and desktop tests run separately in CI.

Install browser dependencies before running browser tests:

```bash
bun run --cwd packages/e2e playwright install --with-deps chromium firefox webkit
```

For manual app validation, use `bun run dev:playwright`, open the printed dashboard URL, and stop it with `bun run dev:playwright:down`. Do not start a development server directly or use the developer database.

Run `bun run --cwd packages/e2e test:smoke` for basic dashboard browser E2E. It runs the real dashboard with isolated runtime data, without starting Storybook. Tests tagged `@smoke` cover the empty and selected project startup flows, project switching, keyboard navigation and creation forms, theme preview cancellation, and choosing a theme through the command palette with persistence after reload. These tests also run in the full UI suite.

## Unused code

`bun run knip` reports unused files, exports, and dependencies across the workspace. CI runs it in the `static_checks` job, so a pull request fails when it leaves dead code or an unused dependency behind. Configure it in `knip.jsonc`:

- Add an entry point when code is loaded by path instead of imported. Examples are webview entries passed to `packageAsset()`, fixtures that tests spawn, and files named in build configs.
- Add an `ignoreDependencies` entry only when a dependency is used where knip cannot see it, and write a comment that names the user. For example, the workbench build inlines `pstdio-extensions` and `pstdio-api-contracts`, so its `dist` imports their `rimless` and `zod` dependencies.

## Coverage

`bun run test:coverage` runs every package's `test:coverage` script with an lcov reporter. Packages and first-party extensions with tests define a `test:coverage` script. It uses the same conditions and runner as the package's `test` script. Run one with `bun run --cwd <package-or-extension> test:coverage`. Build the monorepo first, because this command does not build dependencies.

The README coverage badge shows line coverage for the whole repository. The Coverage workflow runs on each push to `main`. It runs `bun run test:coverage`, then `bun run --cwd scripts coverage:badge -- <path>`. That script reads every `coverage/**/lcov.info` under `packages/*` and `extensions/*` and writes the shields.io badge data. A separate job, the only one with write access, replaces `coverage.json` on the `badges` branch. Pull requests that change the workflow, `scripts/badges/`, or the API test runner run the measurement without publishing it.

A package's report also lists source files from the packages its tests import. The script merges line hits per file, so each source file counts once. It leaves out tests, stories, fixtures, mocks, test helpers, dependencies, build output, and files outside the repository. Bun reports only files that a test loads, so files that no test imports are missing from the total. Bun's lcov output has no function names, so function coverage cannot be merged and the badge shows lines only.

## CI stages

Test and Build runs one stage per event. The `scope` job runs `scripts/ci/pull-request-ci-scope.ts` to choose the stage and the packages to test. `ci_passed` is the only check the `main` ruleset requires, and its meaning depends on the stage.

| Stage | Event | Runs | `ci_passed` requires |
| --- | --- | --- | --- |
| Pull request | Opening, reopening, a new push, or a new label on a pull request | Whole-repo static checks; parallel affected-package lint and unit tests; selected database shards, browser regressions, Windows contracts, compatibility and container checks | Every selected job succeeded; no job failed or was cancelled |
| Merge queue | `merge_group` | At least the checks selected for every PR in the group, plus unsigned builds of every client | Every selected job and client build succeeded |
| Full | A push to `main`, a manual run, or `ci:full` on a PR or any PR in a merge group | Full Windows, browser E2E, desktop and packaged suites, plus the package and compatibility checks | Every required full-stage job succeeded |

A newer event on the same pull request cancels the older run. Every merge queue and `main` commit keeps its own run, so a red commit can always be traced.

### Pull request stage

The normal pull request stage targets five minutes through relevant selection, parallel jobs and build reuse. `ci:full` keeps the longer complete stage. [ADR 0087](../../adrs/0087-run-relevant-pr-checks-before-merging.md) records this design.

The selector compares the PR merge commit with its target parent. Workspace dependencies and explicit Nx dependencies select the changed packages and their transitive consumers. This includes consumers whose dependency ranges name a released SDK or UI version. Unknown shared tooling inputs select all scoped checks.

- `static_checks` runs the whole-repo checks: formatting, documentation links (`bun run --cwd scripts verify:docs-links`), SDK reference coverage (`bun run --cwd scripts verify:sdk-reference`), package boundaries, knip, the lockfile, the extension API version and report, changesets, the monorepo build, committed build outputs, and translations. The documentation checks are offline, so every stage runs them.
- `lint` builds the affected packages and their dependencies, then runs type checking and lint. `unit_tests` builds and runs unit and synchronization conformance tests in parallel with `lint`; unit tests no longer wait for type checking. API and database suites remain in their own shards. E2E-only changes select browser jobs. Package jobs require at least one affected package other than `e2e`.
- `browser_smoke` runs the six basic dashboard flows when code affects the dashboard or its E2E runtime dependencies. Repository tooling and shared build inputs also select it. Documentation-only changes do not.
- `browser_regressions` selects real-app specs for session navigation and state, retained ticket editor state, extension lifecycle, and opaque webview interactions. Short specs run in pairs on parallel runners to share build setup. Each spec starts a separate runtime, home and database, and a failure does not prevent the other spec from running. Session inputs select session specs; editor and Planner/Notes inputs select editor specs; extension inputs select lifecycle and webview specs. Shared UI, SDK, workbench, storage, browser helpers and otherwise unclassified browser dependencies select every maintained regression family. These specs use `playwright.pr.config.ts` without Storybook. Run one locally with `bun run --cwd packages/e2e test:pr -- src/ui/session-menu-parity.spec.ts`.
- `native_contracts` selects short Windows filesystem, process and desktop contracts from changes to those inputs. SDK and API contract changes select filesystem and process checks. Selected groups share one runner's setup and retain their existing test limits. Full Windows database tests and desktop packaging remain in the full stage.
- `database_tests` runs the `pstdio-api` tests in four shards and the `pstdio-db` tests in three, when a change affects either package. Together these suites took 6 to 8 minutes in one job, so each shard runs on its own runner. The `pstdio-db` shards use `bun test --shard`; the API test runner accepts the same `--shard=<index>/<count>` argument.
- `published_extensions` runs for extension, SDK, UI, and API contract changes. `harness_cli_support` runs the minimum supported agent CLIs for harness changes. Documentation files (Markdown, `design/`, and `LICENSE`) do not select either job. `license_check` runs when a `package.json` or `bun.lock` changes.
- `build_docker` builds both images when a `package.json`, `bun.lock`, or `Dockerfile` changes. This catches container install failures before the merge queue.
- `relay_smoke` runs when a change affects `pstdio-relay`, `pstdio-db`, or `pstdio-account-manager`, including their dependencies. It runs the PGlite container lock check, `services/relay` `test:isolated`, `test:storage`, `test:assets`, and `test:transport`, the production relay conformance entry, and `services/account-manager` `test:isolated`. See [Relay development](0006-relay.md).
- A change under `scripts/` or any other file outside the workspace packages lints and tests every package and runs the checks above, including Docker builds. This covers `.dockerignore`, `bunfig.toml`, and `.npmrc`. Markdown files, files under `design/`, and `LICENSE` do not count.

The setup action reuses Bun downloads and portable Nx task archives. Each job starts a loopback HTTP cache backed by the restored Actions cache directory. Nx imports archives through its supported cache API; its machine-bound local database is not shared. Host and Playwright-container caches remain separate, as do operating systems, architectures and toolchain inputs. Nx hashes root compiler settings, the lockfile, build helpers and relevant build environment variables. Chakra's installed theme types regenerate even on a cached UI build. A cache miss runs the normal dependency builds.

The scope emits an explicit required-job list. `ci_passed` fails if any selected job skips or has no result, or if any job fails or is cancelled. Intentionally unselected jobs may skip.

Add `ci:full` when the full Windows, browser, packaged or desktop suites are needed. Adding the label starts a full run, and each later push runs the full stage too. Removing the label starts no run; the next push runs scoped checks. The full stage already includes the targeted browser and Windows contracts, so their separate scoped jobs skip there.

### Merge queue stage

The merge queue applies the same selection policy as PR checks to its combined result. It compares against `merge_group.base_sha`, rather than the last parent alone. It also reads the matching GitHub merge-queue entries and each member's original changed-file list and labels. This preserves a companion PR's `ci:full` and checks for changes that cancel each other in the final tree. Incomplete queue metadata fails scope selection instead of reducing coverage.

- Static, package, database, browser, Windows, compatibility and container jobs use the same selection as PR checks.
- `build_clients` builds without signing, because signing secrets are trusted only on `main` and release tags. The Linux row builds the monorepo, compiles the CLI for every platform with `bun run --cwd scripts build:all`, scaffolds the platform packages, and makes the Linux desktop app. The macOS arm64 (`macos-15`), macOS x64 (`macos-15-intel`), and Windows rows make their desktop apps. Desktop sidecars must be compiled on their own platform, so each desktop app needs a native runner.
- Any group member with `ci:full` selects the complete full stage for the group.

The `main` ruleset turned the queue on on 2026-10-12, after the queue's jobs passed every `main` run since the stages were split. It squashes, builds up to five groups at once, merges up to five pull requests per group, and merges a group only when every pull request in it passed (`ALLGREEN`). `ci_passed` is the only required check, on pull requests and in the queue.

When a pull request leaves the queue, a build or check failed on the merged result. Rebase, fix, and queue it again. If the failure is not caused by the pull request, the check is not deterministic; fix the check first.

### Full stage

Pushes to `main` run the full stage, including coverage outside the scoped regression families. Fix a failure in a follow-up pull request, or link it to the flaky-test ticket that owns it before re-running.

Before using **Re-run failed jobs** on a release or nightly, record the failure on a ticket or link it to the ticket that owns it. Keep the job link, failed step or test, and first-attempt evidence. A passing rerun does not close the bug.

The **Weekly CI failure report** workflow collects every attempt of Test and Build and Release Packages from the last seven days. Its job summary groups failed tests and steps, lists affected branches, counts main and release failures, and shows later same-commit passes. Jobs copied into later attempts are counted once. The main first-attempt rate uses completed push runs and includes failures that later passed.

Run it locally with GitHub CLI authentication: `bun scripts/ci/report-ci-failures.ts --since 2026-10-12T00:00:00Z --until 2026-10-13T00:00:00Z`. Optional `--repository owner/repo` and `--output directory` select the source and output folder. The default folder is `test-results/ci-failures`; it contains `runs.json`, `jobs.json`, `summary.json`, and `summary.md`. Failed logs are parsed in memory; unavailable logs are reported beside their job links. The weekly artifact keeps this report data for inspection.

The full stage adds:

- `lint`, `unit_tests` and `database_tests` for every package, `relay_smoke`, and the published extension, harness CLI, and license checks.
- `windows_test_and_build` has six parallel rows: whole-repo lint and formatting, native and packaged Windows contracts, and four unit-test shards. Each unit row runs one quarter of every package's Bun test files, excluding E2E, API and database suites. It also runs one quarter of the Git worktree files in a separate command that keeps their existing 30-second limit. Every row builds through the shared cache. Reproduce a unit row with `bunx lerna run test --ignore e2e --ignore pstdio-wt --ignore pstdio-db --ignore pstdio-api --stream --concurrency=1 -- --shard=1/4 --timeout=15000`, followed by `bun run --cwd packages/pstdio-wt test --shard=1/4`.
- `windows_database_tests` runs the Windows API suite in eight shards and the database suite in four, each on a separate runner because PGlite setup dominates their serial test time. Each shard builds only its package and dependencies. All Windows rows finish even when another fails, and `ci_passed` requires both matrices to succeed. Run a database/API shard locally with `bun run --cwd packages/pstdio-api test --shard=1/8 --timeout=15000` or `bun run --cwd packages/pstdio-db test --shard=1/4 --timeout=15000`.
- `e2e` (three browser shards), `e2e_cli`, and `packaged_and_vite_e2e`.
- The desktop source Electron specs, packaged renderer benchmarks, and packaged desktop smoke tests in the Linux, macOS arm64, and Windows rows of `build_clients`, run against the unsigned app from the same row. Linux runs them under `xvfb-run`. The Intel macOS row only builds. The release workflow also runs the launch benchmarks and Intel tests against signed release artifacts.
- `packaged_toolchain`, which calls `verify-packaged-toolchain.yml` for the commit to check the compiled CLI on Linux, Intel macOS, and Windows. Linux runs the full packaged suite. Intel macOS runs only the essential CLI, runtime, and extension page tests in `scripts/verify/packaged-runtime-smoke.ts`, as the desktop release runs only `@essential` tests there: slow Intel runners turned timing races in the large UI suite into release failures that other platforms did not have. Windows runs its own short list.

`build_clients` sets `PSTDIO_EXTENSION_RELEASE_REF` to the run's commit, so the packaged apps install that commit's core extensions instead of those of the last release tag.

## macOS release checks

Signed macOS builds submit the app with native `notarytool` from Forge's `postPackage` hook. Submission and ticket retrieval are separate operations. After Apple accepts the upload, `stapler staple` gets up to three attempts for Apple network failures: exit code 68 with `NSURLErrorDomain` in the output. The pauses are one and two seconds. Release verification uses the same rule for `stapler validate`.

Every attempt logs its status and output. Other errors fail at once. This retries an external service call; test retries remain disabled. Validate a change to this path with a nightly release run that builds, notarizes, staples, and verifies both macOS targets.

## Published extension dependencies

Run `bun run --cwd scripts verify:published-extensions` to typecheck and test every extension in the Changesets release group against the registry SDK and UI versions selected by its dependency ranges. The check copies each extension outside the workspace, installs fresh dependencies, runs `tsc --noEmit`, and runs its Bun tests. It preserves shared compiler settings and test isolation, but copies no workspace packages, installed dependencies, or lockfiles. Failures name the extension and command; output shows the resolved SDK and UI versions.

Published-extension checks and public-package consumer checks use a one-day minimum release age for fresh installs. This keeps a third-party publish in progress from selecting packages whose matching dependencies are not available yet. Prompt Studio packages in the Changesets release group are exempt, so these checks can use the SDK and UI immediately after a release. The repository's frozen-lockfile install is unchanged. See [Bun's minimum release age](https://bun.sh/docs/pm/cli/install#minimum-release-age).

On pull requests and merge groups, the CI job runs for extension, SDK, UI, and API contract changes other than documentation files, and for changes outside the workspace packages. It always runs in the full stage. Repo-local packages outside the release group and extensions using `workspace:` SDK dependencies are excluded. The network check stays separate from local `bun run validate`.

## Extension smoke checks

The user-facing `pst extensions test` command is described in [Smoke checks](../extensions/0006-smoke-checks.md). To check its packaged behavior in this repository, build dashboard assets first, run `bun run validate`, then `bun run --cwd scripts verify:packages`. Packaged consumer fixtures exercise passing views, startup exceptions, capability denials caught by guest code, forged host diagnostics, fixed main panels, and browser setup without external JavaScript runtimes. For interactive dashboard validation use `bun run dev:playwright` and stop it with `bun run dev:playwright:down`. These contributor commands are not prerequisites for installed CLI users.

Package verification provisions Chromium through the compiled CLI before starting the timed tests, including on Windows x64. The install test reuses the browser and package caches while checking a fresh caller directory with no external JavaScript runtimes. Cold downloads remain subject to the existing CI job limit instead of the runtime test's 30-second deadline. The compiled bundle leaves out Playwright's optional BiDi modules; see [ADR 0029](../../adrs/0029-temporary-chromium-only-playwright-bundle.md).

`pst extensions install-browser` installs full Chromium without Playwright's separate headless shell (`--no-shell`), and `pst extensions test` launches that browser. Packaged tests launch the same browser with `PROVISIONED_CHROMIUM` from `packages/e2e/src/packaged/packaged-chromium.ts`, which selects Playwright's `chromium` channel. A plain `chromium.launch()` would look for the headless shell, which a clean machine does not have. Use `PROVISIONED_CHROMIUM` for every Chromium launch in a packaged test. Firefox and WebKit cases still need `playwright install`.

Packaged tests need a compiled binary that contains the dashboard. `buildBinary` in the tests compiles `dist/pstdio` but does not build the dashboard, so build it first. Without it, `GET /` returns 404 and browser sign-in waits until its timeout. To prove a clean environment, use a new browser folder and home:

```bash
bun run build -- --scope pstdio-dashboard --include-dependencies
bun run --cwd scripts build:host
export PLAYWRIGHT_BROWSERS_PATH="$(mktemp -d)" PSTDIO_HOME="$(mktemp -d)" E2E_PACKAGED_BINARY_PATH="$PWD/dist/pstdio"
dist/pstdio extensions install-browser
cd packages/e2e && bun test src/packaged/packaged-serve-helpers.test.ts src/packaged/extension-browser-install.test.ts
```

Copy `dist/pstdio` to a private path and point `E2E_PACKAGED_BINARY_PATH` at the copy when another task may rebuild the binary at the same time.

## Isolation

When an assertion waits for child-process or socket output, await the operation before asserting on its result or captured error. Bun's `expect(promise).rejects` and `.resolves` can synchronously drive a nested event loop and block Windows I/O callbacks. See [the pipe-read lesson](../../lessons-learned/0016-bun-expect-rejects-blocks-pipe-reads.md) for the safe rejection pattern.

Bun tests preload `scripts/test-setup.ts`. It removes inherited `PSTDIO_*` runtime settings, creates a temporary home, and restores the environment around each test. Tests that need runtime settings must supply them inside their setup or to the process they start. Do not run tests that mutate `process.env` concurrently in one process.

Windows CI passes `--timeout=15000` to its Bun test commands, including package scripts run through Lerna. Tests and lifecycle hooks get a 15 s default. Explicit test limits and custom runners retain their own limits. Other CI platforms retain their existing defaults. This temporary allowance accounts for hosted Windows runner variance; ADR 0044 records the evidence and removal criteria.

The UI and Vite launchers also remove inherited runtime settings. Each run allocates loopback ports and uses an isolated home and in-memory database. Test controls use the `E2E_` prefix:

- `E2E_PACKAGED_BINARY_PATH` selects an already built binary for packaged tests. The package verifier sets it to the host-compatible release artifact.
- `E2E_REQUIRE_WEBVIEW_BROWSERS=1` makes missing packaged-test browsers fail instead of skip. CI sets it.
- `E2E_BUN_CACHE_DIR` chooses the runtime install cache. Without it, UI runs use a cache per run.
- `E2E_RUN_ID` selects the UI and Vite report directory.

The packaged Planner runtime spec (`packages/e2e/src/packaged/packaged-planner-runtime.spec.ts`) installs the current Planner into a running host and seeds populated projects. It covers saved views, filter controls, Track conflicts, missing caches, and webview reload recovery. The install downloads the Planner's locked dependencies into the test home.

Nx test inputs include the shared preload, root Bun configuration, lockfile, and Bun version. Changing these invalidates cached test results.

Global preferences survive project deletion. Browser specs that read or change notifications use the test fixture in `src/ui/helpers/notification-settings.ts` and opt in with `test.use({ notificationsEnabled: true })` when needed. The fixture restores the previous preference during teardown.

Packaged desktop specs import `test` from `clients/desktop/src/testing/packaged-fixture.ts`. The fixture owns launched process groups and temporary homes. Its teardown runs after a test timeout, even when an unfinished CDP operation prevents the test body from reaching its own cleanup.

Compiled builds generate an empty application database image with the installed PGlite version and current Drizzle migrations. The image holds only `template1`, the database the runtime opens; it leaves out the unused `postgres` and `template0` databases because a first start must write every image file, which is slow on Windows. New, empty database directories load that image, including its migration history. The runtime unpacks the image into `pstdio.db.restoring` beside the data folder, then moves the finished folder into place. A start that stops while unpacking leaves the data folder empty, so the next start unpacks the image again. The normal migrator still runs, so later schema changes follow the same upgrade path. Nonempty directories always open their existing files, including damaged databases that need recovery. This moves PostgreSQL initialization and fresh schema creation into the build and reduces cold startup. PGlite documents this approach in its [pre-populated filesystem guide](https://pglite.dev/docs/prepopulatedfs).

Use the pinned Bun 1.4.2 toolchain for installs and compiled builds. Bun 1.3.14 can reject a valid large tarball when its first network chunk is shorter than the gzip header. This caused intermittent PGlite installation failures on macOS. The [upstream extraction fix](https://github.com/oven-sh/bun/pull/34861) is included in 1.4.2. CI and Docker builds use the same version. The landing-page builder also provides Node 24 for Astro and Vite, matching their runtime in regular CI builds; Bun manages dependencies and runs the package scripts.

Tests install local fixture extensions from `packages/e2e/src/default-extensions.ts`. Select `pstdio.workbench-fixture.harness.fake` for ordinary session tests. A Planner attempt starts a session; `startSession: false` is not a supported command parameter. Tests for a real provider must supply a controlled executable or explicitly opt into live integration tests.

## Browser coverage and failures

Playwright uses one worker and no retries. CI rejects focused Playwright tests (`test.only`). UI and Vite traces are recorded on the first run and retained on failure. This follows [Playwright's trace modes](https://playwright.dev/docs/test-use-options#recording-options).

CI runs CLI E2E and three browser shards in separate jobs. Each shard has its own runtime, home, and database. Files stay intact and use one worker, so ordered tests share no state across runners. Docker builds run in the merge queue and full stages, and on pull requests that change their inputs. Both images copy the root Bun configuration and every workspace manifest so frozen installs use the same workspace graph and linking rules as the checkout. Local extension source stays outside the build context.

Evidence artifact names end in `-attempt-<run_attempt>` so a manual rerun keeps the earlier evidence. UI shards upload `ui-e2e-results-<shard>-attempt-<run_attempt>`; packaged/Vite uploads `packaged-vite-e2e-results-attempt-<run_attempt>`. Desktop test rows upload `desktop-test-results-<target>-attempt-<run_attempt>`; release rows upload `test-results-desktop-<target>-attempt-<run_attempt>`. Windows update checks upload `windows-installation-readiness-attempt-<run_attempt>`. Failed native toolchain checks upload `packaged-toolchain-<platform_pkg>-attempt-<run_attempt>`, including a timestamped `verification.log`.

Browser reports and traces are under `packages/e2e/playwright-report` and `packages/e2e/test-results`. Desktop results are under `clients/desktop/test-results`. Each packaged test home attaches complete redacted copies of `logs.jsonl` and `desktop-runtime.log` as files before removal. Startup errors include the last 50 runtime output lines. Electron traces start before the lifecycle-page wait, after the sidecar startup wait has protected process isolation; an unavailable attachment states why a trace could not start or be saved. Missing evidence warns without replacing the original build or test failure.

Linux UI, CLI, and packaged/Vite jobs use the official `mcr.microsoft.com/playwright:v1.60.0-noble` image. They run as user 1001, matching the owner of GitHub's mounted home directory; Firefox rejects a root process using that user's home. The image includes browser binaries and system libraries, so these jobs do not install Ubuntu packages or browsers during setup. Keep the image version aligned with the installed Playwright version when updating dependencies. Desktop jobs still run on their native Linux and macOS runners.

The browser container installs the root manifest's Bun version with `scripts/ci/setup-container-bun.ts`. This temporary bootstrap uses Bun's official registry archive because the normal setup action requires `unzip`, which the image lacks. ADR 0026 describes when to remove it.

The UI suite has no migration quarantine list. Obsolete dashboard specs were removed. Current tests cover project selection, ticket workflows, session follow-ups, workspace files and terminals, extension lifecycle, and workbench navigation. Add coverage for restored features against the current UI. Live Claude, Codex, and OpenCode follow-up tests skip unless `E2E_AGENTS` selects the provider. Packaged browser checks cover Chromium, Firefox, and WebKit; the main UI suite covers Chromium.

To investigate a failure, keep retries disabled and repeat the affected spec:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/ticket-workflows.spec.ts --repeat-each=5
```

To run one CI shard locally, use `bun run --cwd packages/e2e test:ui -- --shard=2/3`. Keep the same shard total when comparing runs.

In CI, UI shards serve prebuilt `ui`, `pstdio-dashboard`, and `pstdio-workbench` Storybooks from the `storybook-static` artifact. The full stage builds that artifact once before starting the shards. Local `test:ui` keeps Storybook dev servers. To check static output locally, run `bun packages/e2e/src/scripts/build-storybooks.ts`, then use `CI=true` when starting the UI tests. Both paths load a real story before tests begin and keep the existing 60-second startup allowance.

Read the first failure and its trace. Check setup, teardown, and server logs before attributing the failure to an assertion. Storybook startup failures include the tail of the server output. Readiness checks must cancel stalled HTTP requests within their deadline.

Keep the existing job and test time limits. A timeout needs an investigation of the slow phase; see [Time limits](#time-limits). A passing rerun alone does not explain the failure.

The Windows job tests native dependency installation, relative workspace links, scoped dependency watcher events, and concurrent attachment reads before building. After building the SDK dependencies, command discovery tests exercise real process launches with PATH overrides, PATHEXT order, PowerShell siblings, explicit wrapper paths, custom npm prefixes, spaces, Unicode, shell operators, conflicting installations, missing targets, and timeout cleanup. npm fixtures use the pinned `cmd-shim` generator and check both adjacent Node and PATH fallback. Argument round trips include literal percent signs, exclamation marks, and variable-like strings with values present in the child environment. Environment tests cover Windows case-insensitive names without passing host secrets to extensions. The same portable cases run on Linux.

`harness-npm-detection.test.ts` runs the compiled runtime with deterministic OpenCode, Codex, and Claude Code CLI fixtures. It checks detection, versions written to stderr or with terminal colors, a healthy harness alongside failed and hanging probes, project extension filtering, and OpenCode model discovery. It changes installations for the same project and checks discovery again after the availability cache expires. Model requests for all three harnesses must return empty lists when version probes hang, and their child processes must exit. The runtime parent stays alive, and repaired commands must recover detection and model listing in the same runtime after the existing cache expires. The version-probe deadline applies to model listing as well as availability checks. No provider accounts, API keys, or live agent services are required. Harness changes automatically select short native Windows process contracts. Add `ci:full` when checking the compiled Windows npm detection path and the remaining full Windows suites. Keep these tests within the existing CI time limits.

These tests simulate different inherited environments. Real Explorer/login PATH refresh, PowerShell aliases, WSL-only installations, and organization-managed execution policies still need targeted manual checks. Codex and Claude model/session protocols and OpenCode server startup use separate launch paths; this discovery suite does not establish their Windows compatibility. Those paths need dedicated protocol fixtures before changing their launch behavior.

The npm `cmd-shim@7.0.0` batch wrapper assigns its installation directory without quotes. A prefix containing `&` truncates that directory and fails even when the wrapper runs directly under `cmd.exe`. A native regression checks this failure outside the process API and confirms the API reports the failure too. The healthy npm fixtures use spaces and Unicode; a separate controlled wrapper checks our launcher with `&` in its directory.

Readable attachments share their stored bytes through hard links and are removed with the file or project storage. Cover both scoped packages and linked `node_modules` directories, as extension installation uses both. Each Windows database/API shard runs only one package to avoid competing database startups on the same runner. The API suite uses two file workers, then runs `process-discovery.test.ts` alone in its assigned shard so PowerShell startup does not compete with a PGlite cold start. The runner logs when that file starts alone. The separate Windows npm shim check still runs it too.

Non-recursive watcher tests remove dependency trees from another process while refreshing watches, then check that later package changes still refresh the source. This covers directory removal during a filesystem read.

## Chat rendering measurements

The **Patterns/Chat/Chat Panel Streaming Ready** story opens an overflowing conversation while paragraphs arrive on every animation frame. Its play check requires the transcript to appear before the stream stops. Initial tail readiness owns one settling window per conversation mount; streamed layout changes update its DOM measurements without restarting that window. Use Chromium CPU throttling to inspect this case on a slow renderer.

Use the **Patterns/Chat/Chat Panel Rendering** Storybook stories to inspect long turns. `RenderingWorkloads` starts with an empty chat and prepares fixtures before the measured mount. `LongTurnScrolling` checks bounded responses, sticky user context, expansion, scrolling, hidden-page recovery, session switching, and tail following during streaming. `ContinuousScrolling` checks the sticky message on each animation frame while scrolling up and down within one large response. A check that waits for scrolling to settle does not cover this behavior.

The fixed workloads in `packages/ui/src/components/chat-ui/performance/chat-rendering-fixtures.ts` are:

- Rich turns: 500 turns and 1,000 messages, with four Markdown repetitions and three tools per turn.
- Plain turns: the same message roles and count, with short text only.
- Long turns: one rich user message followed by 1,000 or 5,000 rich responses. Each response has one Markdown repetition, reasoning, and three tools.
- Large response: one user message and one response containing 100 repetitions of rich Markdown.

Run `CPU_THROTTLE=1 bun run --cwd packages/ui perf:chat -- chat-rendering.perf.ts` for native Chromium measurements. Repeat with `CPU_THROTTLE=4` for throttled measurements. The existing config runs each workload three times in fresh contexts. Record viewport size, browser version, hardware, commit, and any competing work. Compare the same fixtures and settings before and after a change; report medians and ranges rather than one sample.

The measurement excludes module loading, fixture construction, API requests, and database work. It measures mount, scrolling to the middle, session switching, and streaming one response in 384-character chunks. Readiness requires a visible chat viewport and three animation frames. Each phase attaches a CPU profile, script/layout/style/task times, long tasks, and mounted row/editor/table/DOM counts to the Playwright report. These component timings are not end-to-end session-opening timings. A stopped or timed-out measurement is incomplete, not a performance result. Existing budgets and execution allowances remain unchanged.

The shared chat list virtualizes each user message and response independently with four rows of overscan. It also retains the user row for the visible turn. A native CSS sticky element follows scrolling inside a wrapper bounded by the turn's measured height; its position does not depend on React rendering each scroll offset. Logical turns still determine sticky context, question visibility, and final-response actions; their length does not determine mounted response count. Markdown display imports only changed content and installs editing plugins and source tracking only when editable. Rich messages still use Lexical for selection, copying, links, highlighting, and rich nodes.

The viewport preserves its visible pixel offset across hiding and resumes tail following when appropriate. The scroll library's hidden-element limitation and the isolated restoration hook are recorded in [Temporary hidden conversation scroll restoration](../../adrs/0075-temporary-hidden-conversation-scroll-restoration.md).

This boundary bounds the number of mounted messages, not the size of one message. A large response, an expanded user message, or a merged reasoning/tool timeline still mounts all its content. Parsing, node creation, and layout therefore scale with that content. Measure this limit separately rather than splitting the benchmark input or hiding rich content to make a budget pass.

## Time limits

Tests have two kinds of time limit. [ADR 0067](../../adrs/0067-separate-performance-budgets-from-execution-allowances.md) records the decision.

- A **performance budget** limits one named product operation with a fixed workload. A benchmark owns it and defines the scenario, workload, measured process, start and end events, and unit. Exceeding a budget is a product regression, even when the test finishes well inside its timeout.
- An **execution allowance** limits a whole test, fixture, or job. It covers setup, the operation, and cleanup. Reaching it means the work did not finish. A timed-out run gives a lower bound, not a measured duration.

Functional tests do not assert timings. Benchmarks do not measure test-only setup, tracing, or cleanup, but they include initialization a person waits for, such as macOS checks on the first launch of a signed app. Helpers wait within the deadline of the test that calls them. Do not add a shorter cap inside a helper; it can end a slow but valid phase before the test can report it. Keep prompt failures for real errors, such as a process that exits.

To review a timeout:

1. Find the slow phase: dependency setup, app readiness, the operation, cleanup, reporting, or the whole job. Playwright steps and benchmark attachments show phase timings.
2. Check for hangs, leaked processes, blocked event loops, and expensive setup first.
3. Collect timings from representative local runs with the same workload and build mode as CI. Include cold setup when the test needs it.
4. Inspect several runs on each applicable CI platform, including slow successes and failures. Keep local and CI timings separate; do not average different environments. Record the revision, command, OS and architecture, runner, and cold or warm state.
5. Propose an exact value that covers the slowest legitimate phase with stated headroom. Use platform-specific values only when the evidence shows different work. When relevant local or CI evidence is missing, say so and collect it first.
6. Get approval for that exact value (see AGENTS.md), then verify it locally and in the affected CI jobs. Check that a never-ready case still fails and cleanup still completes.

When tests are added, review the job allowance or sharding. Do not lengthen the per-test limit because a suite has more tests.

Hosted Intel macOS runners run the packaged and desktop suites two to three times slower than other platforms, and one Intel run can take twice as long as another. Every Intel suite therefore allows 60 seconds per test: the desktop Playwright suites (approved on 2026-10-10, together with Windows) and the packaged CLI suite, whose limit `packages/e2e/src/packaged/packaged-test-timeout.ts` sets and `run-packaged-cli-tests.ts` passes to `bun test --timeout` (approved on 2026-10-12, after tests that pass in 11 to 23 seconds on Intel timed out at 30 seconds on a slow runner). Other platforms keep 30 seconds. Tests that set their own longer limit keep it.

## Desktop benchmarks

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

`clients/desktop/src/e2e/packaged-performance-monitoring.spec.ts` covers the monitoring feature without budgets. A reload test forces a 120 ms frame before and after reloading the workbench and requires both to reach the snapshot. An extension process test opens the fixture's Lab webview and requires a process that hosts only that extension, separate from the workbench process. It then pauses the extension from the status bar popover and requires the snapshot to list it in `pausedExtensionIds` and no process to host its frames. A snapshot test reads the snapshot through the preload and through `pst performance` to prove that a person and an agent receive the same measurements, then checks that turning monitoring off stops the endpoint.

The fake agent replays the long conversation when a prompt contains `__fake_long_stream__`: 30 assistant turns, 8 text updates each at 25 ms intervals, and one tool result per turn.

The streaming benchmark opens an empty session before submitting that prompt. Its counter interval covers the full replay, including the last rendered turn. It does not wait for Step 1 to be visible: auto-follow can move that row out of view before an assertion sees it.

`packages/e2e/src/ui/performance-monitoring.spec.ts` covers the same feature in a browser tab. It turns on the Settings switch and checks that the status bar meter appears. It opens the popover, which shows the desktop-only CPU note and lists the fixture extension's open view. It pauses the extension, checks the placeholder, and resumes it. Last, it checks that the switch survives a reload and that **Show performance** opens the setting while monitoring is off. This spec has no time budget.

## Live provider tests

These commands opt into real agent sessions:

```bash
E2E_AGENTS=claude-code bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-completion-claude.spec.ts
E2E_AGENTS=opencode bun run --cwd packages/e2e test:ui -- src/ui/session-follow-up-ordering-opencode.spec.ts
```

They require the selected provider and its credentials. They are separate from ordinary fixture-based CI coverage.
