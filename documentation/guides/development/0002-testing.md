# Tests

## Validation

Use Bun 1.4.4 and Node 24, matching CI. Install dependencies with `bun install --frozen-lockfile`. The database workspace installation generates an empty engine image matched to the installed PGlite version. Source runtimes and migration workers restore this image instead of running PostgreSQL initialization for every open. It contains no application schema or user data; source startup still runs application migrations. Installations that use `--ignore-scripts` must run `bun run --cwd packages/pstdio-db postinstall` before starting the source API. The root pins `node-gyp` so native addon install scripts use the local build tool instead of a temporary `bunx node-gyp@latest` download.

When upgrading Bun, align the root `packageManager` pin, Bun engine requirements, all `@types/bun` dependencies, the lockfile, and every Docker image, including `infra/local/Dockerfile`. Update the local Bun executable and current setup documentation to the same version before validating.

Repository type checks use the TypeScript 7 checker built into Bun 1.4.4. Keep using each package's `typecheck` script: the dashboard checks both project references with `bun check -b`, UI uses `tsconfig.build.json`, and base themes also check `tsconfig.canvas.json`. Chakra token generation still runs before dashboard checking. TypeScript 6.0.2 remains installed for compiler API users and Rolldown declaration emit. Public package and provider consumers check the same positive and negative fixtures with both TypeScript 6.0.2 and `bun check`, so the faster checker preserves the supported consumer contract.

Public package consumers keep the ES2022 output target and include `ES2023.Intl` declarations for the number-range APIs available in the supported runtimes. Fresh dependencies can expose those types in their public declarations. Declaration checking remains strict.

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

Test product behavior. Do not add tests of tests, fixtures, setup, runners, suite selection, reports, or benchmark instrumentation. Repository-local tools do not need their own automated suites. Review these changes with static checks and the affected product scenarios.

```bash
bun run --cwd scripts verify:docs-links      # relative links, published routes, anchors, exported skills
bun run --cwd scripts verify:sdk-reference   # SDK references name every public method
bun run --cwd scripts verify:docs-snippets   # authoring guide code equals infra/local/extensions/bookmarks
```

`static_checks` runs the first two on every stage. External sites are checked separately by the **Documentation links** workflow (`.github/workflows/docs-external-links.yml`) every Monday and on manual dispatch, so an outage elsewhere cannot fail a pull request. Run it locally with `bun run --cwd scripts verify:docs-external-links`.

```bash
bun run test -- --file packages/pstdio-dashboard/src/workbench.p0.test.ts
bun run --cwd packages/pstdio-dashboard test -- src/workbench.p0.test.ts
bun run test -- --scope pstdio-api --priority p1
bun run test -- --stage merge_queue --base origin/main --list
bun run test -- --file packages/e2e/src/ui/startup.p1.spec.ts
```

The standard command discovers tests once, selects their runner, and prepares the dependencies they need. It applies dashboard export conditions and path aliases, API file-process isolation, browser homes, native packaging, and existing time limits. Package `test` scripts use this command with their owning scope. Low-level lifecycle commands remain available for diagnosing their native runners.

Preview a plan with `--list`, optionally saving it with `--out test-results/ci/plan.json`. Saved plans include exact files, reasons, setup dependencies, lanes, required host and artifact, source identity, and a digest. Execute that selection with `bun run test -- --plan test-results/ci/plan.json`; `--job <assignment>` selects one CI assignment. A changed checkout cannot execute a saved plan. Previewing installs or builds nothing. `--stage pull_request`, `merge_queue`, `main`, `nightly`, and `stable` preserve the existing stage policy; nightly and stable expose their functional host assignments. Dedicated performance workflows retain their fixed native workloads and budget classification.

`--file` and positional paths accept repository-relative or owning-package-relative files. `--files-from <json>` selects a nonempty JSON array of discovered repository paths. `--priority p0,p1`, `--scope <workspace>`, and `--runner <kind>` narrow selection. `--artifact compiled-cli` selects packaged CLI cases, including their pure P0 helpers; `--artifact packaged-desktop` selects the packaged Electron cases. Native artifact consumers keep `E2E_PACKAGED_BINARY_PATH` when provided. `--prebuilt` skips build/package prerequisites; fixture preparation and execution evidence still run.

A local selection includes applicable registered quarantine cases once in a separate lane. Use `--lane quarantine` to diagnose only those cases. Complete, verified registered assertion failures stay visible without failing the stable result. Missing cases, skipped quarantine cases, setup errors, cancellation, unexpected execution, and missing native reports fail verification. Bun files are assigned to shards before execution; Playwright retains its native case sharding. Both use the same saved plan and aggregate completeness gate.

`--timings <json>` supplies a frozen version-1 snapshot. Its `capturedAt` and `observations` stay in the plan. Each observation records `kind` (`file` or `package`), repository-relative `key`, `profile` (`<owner>/<runner>` for files, `package-checks` or `contracts` for package batches), `host` (`linux/x64`), `configuration` (`source:stable:P0`), `coverage`, `durationMs`, `samples`, `observedAt`, `sourceSha`, and `provenance`. Only matching observations within thirty days of the snapshot date affect assignment. Missing observations use the shared allocator's compatible median estimate; a snapshot with no matching observations keeps deterministic round-robin assignment. Timing never changes selection or browser case sharding.

Release consumers use `--performance-family storage|planner|desktop --prebuilt` after restoring their exact candidate. These plans retain the complete fixed family and native lifecycle, source and artifact binding, and transported native evidence. `execution.json` records setup, test, and cleanup phases with source, plan, invocation, host, duration, completeness, and known prebuilt status. Fixture-input records separate preparation reuse hits, copied bytes, and copying time. CI timing reports keep required-gate wait, end-to-end completion, unique runner time, and the source workflow's execution critical path separate; unavailable dependencies or timestamps remain unknown.

The root/package default keeps integrations, packaged/native journeys, and performance workloads as explicit selections. An explicit priority, file, runner, or artifact can select these families. Production extension unit tests remain independently runnable with `bun test`, public dependencies, and their own setup. Repository-local tools and demo applications do not have automated suites. Host browser scenarios opt into small installable fixtures for harnesses, webviews, settings, modes, menus, or document layout. The separate Workbench fixture Lab UI is retired; Extension Lab and its example applications remain available.

Compatible priority runs share one completed extension preparation per runner and lane. The executor owns a private directory on the host's temporary storage, separate from checkout reports, so Windows CI's existing Dev Drive also holds package preparation. The producer performs the normal frozen prerequisite installs, retains the package payload cache and immutable public tarballs, removes disposable setup dependencies, and publishes its source/cache catalog only after preparation finishes. Consumers copy source without dependencies and borrow that cache until executor cleanup; every runtime still performs its own fresh install. Ordinary child installers inherit the same cache, including packaged browser workers. Prepared packaged consumers keep their private homes beneath that owner, so forced child termination cannot abandon them outside executor cleanup. Stable and quarantine lanes keep separate preparations. Result uploads exclude producer payloads, including after interruption; execution and native reports remain retained.

Changes to packaged runtime behavior, assets, or file inclusion also require the packaged checks in the [testing guidance](../../guidance/0005-testing.md#5-packaged-files). Documentation-reference-only edits do not.

## Targeted local review

Use focused tests while developing. Before review readiness, commit the candidate and inspect its complete branch diff with:

```sh
bun run test:review --base origin/main --list
bun run test:review --base origin/main
# Add a critical interaction or boundary that the automatic selection does not establish:
bun run test:review --base origin/main --test packages/e2e/src/ui/startup.p1.spec.ts
```

Fetch the base first, following [PR completion](../../guidance/0004-ci.md#1-finishing-a-pull-request). The command rejects dirty source, unknown options, and unknown extra tests. It selects from the merge base through HEAD, including changes in earlier commits and deletions. The list operation does not install or build.

| Layer | Selection |
| --- | --- |
| Static | Documentation links; changed code formatting and boundaries; public contract checks when relevant |
| Queue minimum | All fast repository/package P0; affected P1 API/database and Bun contracts; affected service integrations; canonical dashboard smoke; packaged desktop smoke and affected packaged flows. Membership comes from the common PR/merge-queue planner and owning runners |
| Additional contracts | Affected source/API/CLI contracts, including consumers of changed helpers and fixtures |
| Changed tests | Added or edited files at every priority, using the registered runner |
| Browser | Always run the canonical `e2e test:smoke` command used by queue CI, plus edited or explicitly selected app scenarios |
| CI evidence | Normal PR checks, plus explicitly justified exceptional coverage; deferred breadth is an inventory for nightly/release coverage, not a mandatory PR matrix |

Execution currently supports macOS and Linux; Windows agents can inspect the plan and use isolated CI. Every invocation includes the shared PR/queue test minimum on the actual local host, including packaging and its selected flows; Linux artifact qualification remains a hosted CI requirement. This applies even to narrow or documentation-only diffs; documentation-only tasks can still use scoped verification without invoking this command. Queue tests are never deferred. The command installs into a private scratch clone, builds selected prerequisites once with one build task at a time, then executes checks serially. Existing runner worker pools and per-test limits remain unchanged. It does not create a Prompt Studio implementation workspace or run workspace-ready hooks. Mutable dependencies, Nx indexes, restored build outputs, reports and runtime state belong to that run. Browser scenarios use the existing wrapper's dynamic ports and isolated home. A running Docker daemon is required for queue service integrations. Missing prerequisites fail the run rather than skipping tests. Install supported browser binaries beforehand; the immutable browser cache remains readable across runs. Source tests use their existing temporary fixtures. Service integrations use unique Compose projects and automatically allocated networks. Each launcher records its exact project and config before startup; the supervisor cleans those projects after stopping test processes, including on interruption. Cleanup failures prevent a pass; unrelated Docker resources are never pruned.

The local target is **15 minutes from invocation**, including source selection, clone, install, build, tests and owned-process cleanup. This is a target, not a cancellation deadline. Broad changes must finish every selected check even when they take longer. The runner warns at 15 minutes, continues automatically, and records elapsed time and `exceededTarget` in its report. Never reduce coverage or shorten a benchmark to meet the target. Explicit interruption still stops owned processes and preserves partial evidence. Individual test, fixture and CI job limits remain unchanged.

Local prerequisite builds reuse the existing Nx HTTP archive protocol. Worktrees of one repository share complete archives under the Git common directory's `pstdio-local-review-builds/v1/<platform>-<architecture>/` folder. Each invocation owns a loopback server that stops with the run. Archive publication is atomic and never replaces an existing entry. Nx hashes source and transitive inputs, configuration, declared build environment and Bun/Node/platform runtimes. Cache misses build normally; an unavailable cache at startup falls back to cold builds. Dependencies and restored outputs remain private. Installed Chakra theme declarations are regenerated in every private install before cached builds, because they live outside the archived outputs. Only prerequisite setup receives this endpoint; all selected tests still execute. Do not share archives across untrusted repositories or delete the shared archive directory while other runs are active.

Reports live in `test-results/local-review/<run-id>.json`. Each report names the revision, merge base, plan, phase commands, durations, result and private evidence directory. Its `buildCache` field records the shared archive directory, hit/miss/store counts and any startup failure; use these with build-phase timings to compare cold and warm runs. The worker's `checks.json` and runner artifacts record individual check results. Bun’s [parent-death and descendant cleanup](https://bun.sh/blog/bun-v1.4#no-orphans-v1-3-14v1-4-0), owned process groups, and a descendant snapshot protect cancellation, including detached children. Tests keep their usual environment so daemon-lifecycle assertions retain their meaning. Scratch directories are retained for diagnosis; remove only the directory named in your report after retaining the needed evidence. Never delete another run's resources.

`local_passed` means the selected local checks passed. Review readiness also requires normal latest-head PR CI and any explicitly required exceptional checks. The deferred list records coverage not run locally; it does not require `ci:full`, native, packaged or benchmark matrices for every PR. Report unrun and failed diagnostics honestly without treating optional breadth as a routine readiness gate.

Native, additional packaged and benchmark suites beyond the required profile are reserved for exceptional high-risk changes that focused checks cannot establish, or an explicit user request. Record the concrete risk, affected behavior and smallest complete owning workload before dispatch. A transitive shared dependency or an unedited deferred test alone is not enough. Normal nightly and stable validation continue to cover complete matrices.

When an exceptional case needs source benchmark qualification, use `gh workflow run benchmarks.yml --ref <candidate-branch> -f commits=<exact-sha> -f qualify_source=true -f release_channel=stable`. This preserves the selected suite’s original workloads, host policy, quarantines and limits. Do not use this as a routine PR completion step. Source qualification does not publish or certify signed release artifacts.

After repairs, rerun failed or affected checks and record their inputs. A complete full-suite rerun is not required. Documentation and routine cosmetic changes retain [scoped verification](../../guidance/0005-testing.md#4-prove-it-works). Explicit full-validation requests still apply. Existing runs keep their original commands, revisions and interrupted or completed status.

## Complete a full test run without stopping at the first failure

The shorthand `bun run test` uses Lerna's default bail and chains later phases with `&&`. A failure can therefore leave most of the required workload unrun. For full validation, run the following phases individually, in order, retaining each exit status and log. Continue after test failures; do not join the commands with `&&` or use a shell that exits after the first failed command.

```sh
CI_PRIORITY=P2 bun x --no-install lerna run test --no-bail --concurrency 1 --ignore e2e --ignore canvas-tests
CI_PRIORITY=P2 bun run build -- --scope e2e --include-dependencies --no-bail --concurrency 1
bun test:p1 --scope e2e --runner bun
CI_PRIORITY=P2 bun run --cwd packages/e2e test:cli
CI_PRIORITY=P2 bun run --cwd packages/e2e test:ui
CI_PRIORITY=P2 bun run --cwd packages/e2e test:vite-terminal
CI_PRIORITY=P2 bun x --no-install lerna run build:previews --scope canvas-tests --no-bail --concurrency 1
```

Run the Canvas browser phase only after its preview build above succeeds on the current source. The `test:canvas` shorthand does not guard this dependency when collecting failures under P2.

```sh
CI_PRIORITY=P2 bun run --cwd packages/canvas-tests test:browser
```

This covers the normal full-test workload without dropping later independent phases after a failure. P2 disables the P1 fail-fast behavior inside maintained runners; it does not shorten the workload or change time limits. If a build fails, do not run dependent tests against old output. Record the blocked phases and finish any independent phases. A nonzero result or an unrun required phase means the full run did not pass, even if the last command succeeds. Required packaged, desktop and benchmark scopes remain separate and follow the same repair cycle.

Collect all failures before repairing them as a batch. During repairs, select only failed cases/files and new regressions through the owning runner. Run blocked or unrun scopes once their prerequisites are repaired. For example, the API's `--files` option and Playwright's file selection/`--grep` avoid rerunning successful suites. Keep whole benchmark workloads and inseparable fixtures intact. Preserve the first failure; a later pass without a cause repair does not resolve it.

Use this complete sequence only for explicitly requested full validation. Collect failures, repair them together, and rerun failed or affected checks. Repeat the entire sequence on final source only when the explicit validation request requires it. Submit consolidated fixes for normal latest-head CI; do not manually restart successful jobs.

## Browser and API setup

Install browser dependencies before running browser tests:

```bash
bun run --cwd packages/e2e playwright install --with-deps chromium firefox webkit
```

For manual app validation, use `bun run dev:isolated -- --name <unique-run-id>`, open the printed dashboard URL, and stop only that stack with `bun run dev:isolated -- --name <unique-run-id> --down`. The legacy `dev:playwright` shortcuts share a fixed name and must not be used concurrently. Do not start a development server directly or use the developer database.

Run `bun run --cwd packages/e2e test:smoke` for basic dashboard browser E2E. It runs the real dashboard with isolated runtime data, without starting Canvas. The discovered startup P1 file covers empty and selected project flows and project switching. Keyboard/theme permutations remain in their P2 suite. These tests also run in the full UI suite.

API tests retain one fresh Bun process per file and at most two active files, with the existing 30-second per-test limit. Run focused API regressions with `bun run test -- --file packages/pstdio-api/src/app-config.p0.test.ts`. The API driver accepts only the exact planned files and keeps its fresh file-process pool. Its low-level `--files` and `--timings` options remain available for runner diagnosis. The API pool and shared planner reuse the same deterministic duration allocator, retaining round-robin assignment without observations and median estimates for missing durations.

`scripts/ci/run-bun-tests.ts` adds `--bail=1` only for `CI_PRIORITY=P1`; other priorities collect all failures. The API scheduler also stops pending P1 files and waits for active child processes to stop. App Playwright uses `maxFailures=1` only for P1. Existing test limits, source conditions, and manual quarantine selection remain unchanged.

The standard executor saves `execution.json` beside per-run native case reports under `test-results/ci/planned`. Direct lifecycle calls retain their native report folders. Reports include actual source revision, platform, priority, JUnit case IDs and outcomes, executed counts, and per-file timings. API reports list every selected file and distinguish failures, P1 cancellation, external cancellation signals, and missing reports. A successful child without a case report fails. Bun's bailed JUnit omits later cases, so partial reports explicitly leave the unreported selected-case count unknown. Direct `bun test` calls do not produce these wrapper manifests.

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

## Installed-product checks

- Check the installed behavior affected by the change. A source workspace can supply unpublished SDK APIs, dependencies, or files that the installed product lacks.
- Use the packaged app when packaging or file inclusion changes. Install extensions outside the monorepo against their declared published dependencies; see [published extension dependencies](#published-extension-dependencies).
- Use disposable projects and isolated runtime data. Choose a representative affected flow: create a project, install and use a tool, update it, or remove it. Check reopen and restart when persistence or cleanup changes.
- Compare cold and warm setup when installation or startup performance changes. Record whether the home and download cache were fresh or reused.
- Require a manual browser or native-app walkthrough only for the critical risks in the [testing guidance](../../guidance/0005-testing.md#4-prove-it-works). Keep relevant automated packaged checks; a successful API response alone does not prove that the primary task works.
- Record the build, platform, dependency versions, actions, expected and observed results, and useful logs. Include timings for performance changes and state what remains unchecked.

## Published extension dependencies

Run `bun run --cwd scripts verify:published-extensions` to typecheck and test every extension in the Changesets release group against the registry SDK and UI versions selected by its dependency ranges. The check copies each extension outside the workspace, installs fresh dependencies, runs `bun check`, and runs its Bun tests. It preserves shared compiler settings and test isolation, but copies no workspace packages, installed dependencies, or lockfiles. It copies build output that is already in the extension folder, so build Canvas first with `bun run build -- --scope canvas --include-dependencies`: its preview catalog is built from this repo's UI and is not committed. Failures name the extension and command; output shows the resolved SDK and UI versions.

Published-extension checks and public-package consumer checks use a one-day minimum release age for fresh installs. This keeps a third-party publish in progress from selecting packages whose matching dependencies are not available yet. Prompt Studio packages in the Changesets release group are exempt, so these checks can use the SDK and UI immediately after a release. The repository's frozen-lockfile install is unchanged. See [Bun's minimum release age](https://bun.sh/docs/pm/cli/install#minimum-release-age).

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
cd packages/e2e && bun test src/packaged/packaged-serve-helpers.p2.test.ts src/packaged/extension-browser-install.p1.test.ts
```

Copy `dist/pstdio` to a private path and point `E2E_PACKAGED_BINARY_PATH` at the copy when another task may rebuild the binary at the same time.

## Isolation

Packaged desktop update-channel and database-recovery tests use `PSTDIO_DEFAULT_EXTENSIONS=[]`. They keep real project creation, Settings and CLI checks, database ownership conflicts, damaged control files, and recovery after repair. These host checks do not use an agent harness. Failing navigation-customization and cold core-extension smoke cases were removed with the quarantine cleanup. Their failure evidence and source remain in Git history. Attached backend shutdown retains its existing cold extension setup.

The signed Windows installation check follows [the 0.46 database baseline](../../adrs/0103-database-baseline-replaces-in-place-upgrades.md). Updating an older baseline must retain the raw database and the original project's JSON export, preserve workspace files, and support a new project in the fresh database. Updates within the current baseline must preserve the active project. Installer, signature, launcher, CLI, and Squirrel feed checks run for both transitions.

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

Queue CI runs CLI contracts and up to two P1 app browser shards independently. Production adds up to six P2 app shards. Component owner/priority rows build and run independently in `packages/canvas-tests`. Each app shard has its own runtime, home, and database. Files stay intact and use one worker, so ordered tests share no state across runners. Docker build breadth runs in production. Both images copy the root Bun configuration and every workspace manifest so frozen installs use the same workspace graph and linking rules as the checkout. Local extension source stays outside the build context.

Evidence artifact names end in `-attempt-<run_attempt>` so a manual rerun keeps the earlier evidence. UI shards upload `ui-e2e-results-<shard>-attempt-<run_attempt>`; packaged/Vite uploads `packaged-vite-e2e-<suite>-results-attempt-<run_attempt>`. Component rows upload `component-results-<owner>-<priority>-attempt-<run_attempt>`. Desktop test rows upload `desktop-test-results-<target>-shard-<index>-of-<total>-attempt-<run_attempt>`; release rows upload `test-results-desktop-<target>-attempt-<run_attempt>`. Windows update checks upload `windows-installation-readiness-attempt-<run_attempt>`. Native toolchain checks upload `packaged-toolchain-<platform_pkg>-shard-<index>-of-<total>-attempt-<run_attempt>` with test results and traces. Their timestamped build and verification output remains in the GitHub job log.

Intel Mac desktop CI runs its packaged smoke files in two required Playwright shards under the existing 20-minute job allowance. Both jobs build a real native app; source Electron tests, native cleanup tests, existing quarantine execution and shared build archives belong to shard one. Other desktop targets use one complete shard. Published desktop targets remain unique physical platforms. The normal developer command still runs the complete unsharded suite.

Windows ARM64 packaged runtime checks use two Bun file shards within the existing 30-minute job allowance. Other native toolchains use one shard. Both ARM64 shards remain required; each keeps compiled-file integrity, public package contracts and compiled CLI smoke. Compiled CLI quarantine runs once per platform on its first shard. `bun run --cwd scripts verify:packages --profile full --shard 1/2` selects one runtime shard; omit `--shard` to run the complete suite. Released candidates still use `--prebuilt`, so neither shard rebuilds their immutable binary.

Packaged toolchain checks run through the CI runner with direct arguments and the operating system's default shell. Do not wrap Windows verification in a Git Bash pipeline: it gives child processes an inherited Ctrl+C-ignore attribute, preventing the real terminal interruption check from exercising normal Windows signal handling.

Windows packaged-toolchain CI opts into a ReFS Dev Drive owned by the job and sets `TEMP` and `TMP` to a folder on it. Other Windows jobs keep `TEMP` and `TMP` on `RUNNER_TEMP`, preserving their existing database and detached-process fixtures. The opt-in puts cold packaged runtime homes and install caches on storage that writes many small files quickly. Every fixture still creates a fresh home and cache, and cleanup stays inside its existing test allowance. On the `C:` system volume, the only volume on Windows ARM64 runners, cold extension installs exceed that allowance. [ADR 0114](../../adrs/0114-temporary-windows-ci-job-temp-directory.md) records the temporary storage override and its removal check.

App reports and traces are under `packages/e2e/playwright-report` and `packages/e2e/test-results`; component reports use those folder names under `packages/canvas-tests`. Desktop results are under `clients/desktop/test-results`. Each packaged test home attaches complete redacted copies of `logs.jsonl` and `desktop-runtime.log` as files before removal. Startup errors include the last 50 runtime output lines. Electron traces start before the lifecycle-page wait, after the sidecar startup wait has protected process isolation; an unavailable attachment states why a trace could not start or be saved. Missing evidence warns without replacing the original build or test failure.

Linux UI, CLI, and packaged/Vite jobs use the official `mcr.microsoft.com/playwright:v1.60.0-noble` image. They run as user 1001, matching the owner of GitHub's mounted home directory; Firefox rejects a root process using that user's home. The image includes browser binaries and system libraries, so these jobs do not install Ubuntu packages or browsers during setup. Keep the image version aligned with the installed Playwright version when updating dependencies. Edited-test rows on Linux for the app, CLI, packaged-browser, Vite, component and browser-helper runners use the same image, matching where their nightly suites run. Desktop jobs still run on their native Linux and macOS runners because they configure Electron's sandbox with `sudo`. They drive Electron rather than a Playwright browser, so they install no browsers. Packaged CLI rows run on the native toolchain hosts their nightly suite uses. Those rows, macOS browser rows, and browser benchmark suites install the browsers they use.

The browser container installs the root manifest's Bun version with `scripts/ci/setup-container-bun.ts`. This temporary bootstrap uses Bun's official registry archive because the normal setup action requires `unzip`, which the image lacks. ADR 0026 describes when to remove it.

Obsolete dashboard specs were removed. Current tests cover project selection, ticket workflows, session follow-ups, workspace files and terminals, extension lifecycle, and workbench navigation. Add coverage for restored features against the current UI. Live Claude, Codex, and OpenCode follow-up tests skip unless `E2E_AGENTS` selects the provider. Packaged native-settings checks cover Chromium, Firefox, and WebKit; the main UI suite covers Chromium. The packaged webview suite gives Chromium commands/settings, workspace panels/session tabs, and documents/collections independent cold fixtures and test results; Firefox retains commands/settings. The failing WebKit case was removed. Remaining cases keep the existing 120-second per-test allowance.

### Failing quarantined tests

Remove known-failing quarantined cases and their entries from `scripts/ci/test-quarantine.json`. For a mixed file, remove only the failing case or generated variant and its unused setup. Delete the file when no cases remain. Preserve the first-failure evidence in the ticket or report and use Git history when restoring coverage after a fix. Do not rename, skip, retry, relax, or return the failed case to the stable lane.

The recorded failing cases have been removed and the registry is empty. The quarantine runners remain available for focused diagnosis. If a case is registered during diagnosis, its separate lane must execute it exactly once and retain the native report; missing reports, setup failures, skipped cases, and retries still fail verification. A passing stable gate does not mean the diagnostic case passed.

To investigate a failure, keep retries disabled and run only the affected spec once:

```bash
bun run --cwd packages/e2e test:ui -- src/ui/ticket-workflows.p2.spec.ts
```

To run one CI shard locally, use `bun run --cwd packages/e2e test:ui -- --shard=2/3`. Keep the same shard total when comparing runs.

App UI tests in `packages/e2e` never build or start Canvas. Component browser interactions live in the private `packages/canvas-tests` package, while story source stays beside its component. This suite starts only Canvas servers; it has no application API, database, or app web server.

Run critical component contracts with `bun test:p1 --runner component`. The command builds the selected owners and serves their static Canvas previews. To run a single spec, build its owner with `bun run --cwd packages/pstdio-workbench build:preview-tests`, then use `CANVAS_TEST_PACKAGES=pstdio-workbench bun run --cwd packages/canvas-tests test:browser -- src/ui/pstdio-workbench/panel-tabs.p1.spec.ts`. Static output lives under each owner's `canvas-test-static` directory. Servers load a real story before tests begin, preserve story play completion waits, and keep the existing 60-second startup allowance. Reports and traces live under `packages/canvas-tests/playwright-report` and `packages/canvas-tests/test-results`.

Read the first failure and its trace. Check setup, teardown, and server logs before attributing the failure to an assertion. Canvas startup failures include the tail of the server output. Readiness checks must cancel stalled HTTP requests within their deadline.

Keep the existing job and test time limits. A timeout needs an investigation of the slow phase; see [Time limits](#time-limits). A passing rerun alone does not explain the failure.

The Windows job tests native dependency installation, relative workspace links, scoped dependency watcher events, and concurrent attachment reads before building. After building the SDK dependencies, command discovery tests exercise real process launches with PATH overrides, PATHEXT order, PowerShell siblings, explicit wrapper paths, custom npm prefixes, spaces, Unicode, shell operators, conflicting installations, missing targets, and timeout cleanup. npm fixtures use the pinned `cmd-shim` generator and check both adjacent Node and PATH fallback. Argument round trips include literal percent signs, exclamation marks, and variable-like strings with values present in the child environment. Environment tests cover Windows case-insensitive names without passing host secrets to extensions. The same portable cases run on Linux.

`harness-npm-detection.p1.test.ts` runs the compiled runtime with deterministic OpenCode, Codex, and Claude Code CLI fixtures. It checks detection, versions written to stderr or with terminal colors, a healthy harness alongside failed and hanging probes, project extension filtering, and OpenCode model discovery. It changes installations for the same project and checks discovery again after the availability cache expires. Model requests for all three harnesses must return empty lists when version probes hang, and their child processes must exit. The runtime parent stays alive, and repaired commands must recover detection and model listing in the same runtime after the existing cache expires. The version-probe deadline applies to model listing as well as availability checks. No provider accounts, API keys, or live agent services are required. Harness changes receive affected fast checks; the queue retains Linux/macOS integrity. Windows npm detection and the full native matrix run in production functional validation. Add `ci:full` to request separate full functional diagnostics for an internal PR. Keep these tests within the existing CI time limits.

These tests simulate different inherited environments. Real Explorer/login PATH refresh, PowerShell aliases, WSL-only installations, and organization-managed execution policies still need targeted manual checks. Codex and Claude model/session protocols and OpenCode server startup use separate launch paths; this discovery suite does not establish their Windows compatibility. Those paths need dedicated protocol fixtures before changing their launch behavior.

The npm `cmd-shim@7.0.0` batch wrapper assigns its installation directory without quotes. A prefix containing `&` truncates that directory and fails even when the wrapper runs directly under `cmd.exe`. A native regression checks this failure outside the process API and confirms the API reports the failure too. The healthy npm fixtures use spaces and Unicode; a separate controlled wrapper checks our launcher with `&` in its directory.

Readable attachments share their stored bytes through hard links and are removed with the file or project storage. Cover both scoped packages and linked `node_modules` directories, as extension installation uses both. Each Windows database/API shard runs only one package to avoid competing database startups on the same runner. The API suite uses two file workers, then runs each `*.exclusive.p[0-3].test.ts` file alone in its assigned shard, so slow process startup does not compete with a PGlite cold start. The runner logs when such a file starts alone.

Non-recursive watcher tests remove dependency trees from another process while refreshing watches, then check that later package changes still refresh the source. This covers directory removal during a filesystem read.

## Chat rendering measurements

The **Design system/Patterns/Chat/Chat panel streaming ready** story opens an overflowing conversation while paragraphs arrive on every animation frame. Its play check requires the transcript to appear before the stream stops. Initial tail readiness owns one settling window per conversation mount; streamed layout changes update its DOM measurements without restarting that window. Use Chromium CPU throttling to inspect this case on a slow renderer.

Use the **Design system/Patterns/Chat/Chat panel rendering** Canvas stories to inspect long turns. `RenderingWorkloads` starts with an empty chat and prepares fixtures before the measured mount. `LongTurnScrolling` checks bounded responses, sticky user context, expansion, scrolling, hidden-page recovery, session switching, and tail following during streaming. `ContinuousScrolling` checks the sticky message on each animation frame while scrolling up and down within one large response. A check that waits for scrolling to settle does not cover this behavior.

The standalone rich/plain/1,000/5,000-response timing permutations and profiling suite are retired by PS-233. Canvas stories remain exploration and functional examples. B4 owns the fixed end-to-end streaming workload; temporary profiles stay outside acceptance. See the [frozen workload ledger](../../references/performance/0009-frozen-workload-ledger.md) for unchanged product targets and unresolved old guards.

The shared chat list virtualizes each user message and response independently with four rows of overscan. It also retains the user row for the visible turn. A native CSS sticky element follows scrolling inside a wrapper bounded by the turn's measured height; its position does not depend on React rendering each scroll offset. Logical turns still determine sticky context, question visibility, and final-response actions; their length does not determine mounted response count. Markdown display imports only changed content and installs editing plugins and source tracking only when editable. Rich messages still use Lexical for selection, copying, links, highlighting, and rich nodes.

The viewport preserves its visible pixel offset across hiding and resumes tail following when appropriate. The scroll library's hidden-element limitation and the isolated restoration hook are recorded in [Temporary hidden conversation scroll restoration](../../adrs/0075-temporary-hidden-conversation-scroll-restoration.md).

This boundary bounds the number of mounted messages, not the size of one message. A large response, an expanded user message, or a merged reasoning/tool timeline still mounts all its content. Parsing, node creation, and layout therefore scale with that content. Investigate this limit with temporary profiling; do not shrink frozen input or hide rich content to pass a budget.

## Time limits

Tests have two kinds of time limit. [ADR 0067](../../adrs/0067-separate-performance-budgets-from-execution-allowances.md) records the decision.

- A **performance budget** limits one named product operation with a fixed workload. A benchmark owns it and defines the scenario, workload, measured process, start and end events, and unit. Exceeding a budget is a product regression, even when the test finishes well inside its timeout.
- An **execution allowance** limits a whole test, fixture, or job. It covers setup, the operation, and cleanup. Reaching it means the work did not finish. A timed-out run gives a lower bound, not a measured duration.

Functional tests do not assert timings. Benchmarks do not measure test-only setup, tracing, or cleanup, but they include initialization a person waits for, such as macOS checks on the first launch of a signed app. Helpers wait within the deadline of the test that calls them. Do not add a shorter cap inside a helper; it can end a slow but valid phase before the test can report it. Keep prompt failures for real errors, such as a process that exits.

Scope each benchmark to one operation. Establish explicit readiness prerequisites before starting its clock. For sync, prepare the app and its installed tools first, then trigger and measure synchronization; measure cold startup and installation separately. Name the start event, end event, workload, and prerequisites in the evidence. Do not combine unrelated phases under one operation's budget or wait for the measured work to finish before starting its clock. Functional readiness assertions are execution waits, not benchmark measurements.

The database package's `test` and `test:coverage` tasks declare Nx `parallelism: false`. Nx runs each without competing package tasks from the same invocation. The export-worker check starts both real database engines within its existing allowance; concurrent package work can starve that setup. Other package tasks keep their normal concurrency. `NX_PARALLEL` alone does not limit Lerna's explicit package concurrency.

The retired subnav benchmark measured trusted clicks and request completion in the browser's monotonic clock. Match every observed request to its [Resource Timing](https://www.w3.org/TR/resource-timing/) entry, including repeated URLs. Missing or ambiguous timing fails the measurement. Do not subtract browser `performance.timeOrigin` from protocol wall-clock timestamps: those clocks can disagree and report minutes for a request the browser completed in milliseconds. Network observation still verifies quiescence, response status, content and all linked sessions.

To review a timeout:

1. Find the slow phase: dependency setup, app readiness, the operation, cleanup, reporting, or the whole job. Playwright steps and benchmark attachments show phase timings.
2. Check for hangs, leaked processes, blocked event loops, and expensive setup first.
3. Collect timings from representative local runs with the same workload and build mode as CI. Include cold setup when the test needs it.
4. Inspect several runs on each applicable CI platform, including slow successes and failures. Keep local and CI timings separate; do not average different environments. Record the revision, command, OS and architecture, runner, and cold or warm state.
5. Propose an exact value that covers the slowest legitimate phase with stated headroom. Use platform-specific values only when the evidence shows different work. When relevant local or CI evidence is missing, say so and collect it first.
6. Get approval for that exact value (see [timeout approval](../../guidance/0004-ci.md#3-ci-timeouts-and-performance-budgets)), then verify it locally and in the affected CI jobs. Check that a never-ready case still fails and cleanup still completes.

When tests are added, review the job allowance or sharding. Do not lengthen the per-test limit because a suite has more tests.

Hosted Intel macOS runners run the packaged and desktop suites two to three times slower than other platforms, and one Intel run can take twice as long as another. Every Intel suite therefore allows 60 seconds per test: the desktop Playwright suites (approved on 2026-10-10, together with Windows) and the packaged CLI suite, whose limit `packages/e2e/src/packaged/packaged-test-timeout.ts` sets and `run-packaged-cli-tests.ts` passes to `bun test --timeout` (approved on 2026-10-12, after tests that pass in 11 to 23 seconds on Intel timed out at 30 seconds on a slow runner). Other platforms keep 30 seconds. Tests that set their own longer limit keep it.

On 2026-10-28 the user approved a 60-second Windows allowance for two packaged cases: Planner board panning and three-host extension synchronization. In [release run 40688319361](https://github.com/pufflyai/prompt-studio/actions/runs/40688319361), the ARM64 board case reached edge-scrolling verification at 29.48 seconds and timed out at 30 seconds; the x64 three-host case also reached its 30-second limit. These named allowances cover setup, behavior checks and cleanup. Other platforms, other cases and performance budgets retain their existing limits. P2 browser workloads use twelve shards and retain the 18-minute job allowance.

## Desktop benchmarks

Use [Write a benchmark](0016-writing-benchmarks.md#desktop-benchmarks) for packaging commands, shared helpers, sampling, desktop workloads and budget evidence. The [nonfunctional requirements](../../guidance/0003-nonfunctional-requirements.md) set mandatory product targets. Regular performance coverage runs in nightly CI and stable-release validation.

Installed harness compatibility resolves and pins npm versions before execution. When `latest` equals `minimum` and both lanes are scheduled, the required minimum lane owns their single execution; a latest-only invocation still executes. The installed Pi compatibility suite retains its tool/session-resume case. Its failing cold detection/model case was removed with the quarantine cleanup.

## Critical UI checks

Require browser or visual checks only for critical risks: a blocked primary task, hidden essential content or controls, broken keyboard/focus behavior, preview isolation, or a critical regression. Use the smallest representative scenario. Add screenshot comparisons only when appearance is the critical contract and behavioral assertions cannot establish it. Routine copy, spacing, cosmetic, and documentation changes do not require browser runs or screenshots. Explicit user-requested visual verification still applies.

Keep Canvas examples for design exploration without a corresponding test per example. Identify the critical risk in each retained browser test. Avoid exhaustive variant, viewport, and theme matrices; remove duplicate checks already covered by owning-package tests. Ordinary relevant unit, type, and build checks still apply. Fixed performance workloads and budgets remain unchanged.

Run `bun run test:canvas` for the native Canvas fixture harness and critical browser checks. It uses the live preview renderer and sandbox. Test failures retain Playwright reports, traces, and screenshots.

The cross-container database ownership check keeps its SQLite lease on a unique Docker-owned volume. Docker Desktop host bind mounts do not provide the Linux file-lock semantics this check exercises. Only readiness signals and the source checkout use host mounts. The fixture retains its Compose configuration for interrupted local-review cleanup and removes its containers and volume when complete.
