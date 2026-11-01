# CI stages

This guide explains how a change moves from a pull request to a stable release, and which tests run at each step. [ADR 0129](../../adrs/0129-prioritize-merge-checks-and-certify-release-candidates.md) records why CI is split this way.

```text
pull request ──► merge queue ──► main ──► nightly (daily) ──► stable release (manual)
 P0 + edited     P0 + contracts smoke     P0–P3, all hosts     P0–P3, signed apps
```

Each stage has its own purpose. A later stage never trusts a result from a different commit: the queue tests the exact merged commit, and a release tests the exact files it will publish.

## Test priorities

Every test file names its priority before the runner suffix, for example `session-state.p0.test.ts` or `startup.p1.spec.ts`. The priority decides when the complete suite runs. Tests a PR adds or edits run in required PR CI at every priority. The queue does not run the `edited_tests` matrix, but its P0 and selected P1 checks can run the same files again. Test discovery reads the filename; workflows never list test files. A test filename without a priority fails CI.

| Priority | What it protects | Runs in | Examples |
| --- | --- | --- | --- |
| P0 | Fast rules: types, validation, permissions, state changes, focused extension logic, repository and CI rules | Pull request, queue, nightly, stable | `session-state.p0.test.ts` |
| P1 | Essential product behavior: session, workspace and extension lifecycles, data safety, restart and upgrade, sync, a working app, native and compiled startup | Queue for source contracts and startup smoke; complete suites in nightly/stable | `session-isolation.p1.test.ts`, `startup.p1.spec.ts` |
| P2 | Breadth: extension feature workflows, component variants, more browsers and platforms, full install and update matrices | Nightly, stable | `planner-board.p2.spec.ts` |
| P3 | Performance: startup, responsiveness, throughput, resource use, scale and endurance | Nightly, stable | `startup.p3.bench.ts`, `chat-rendering.p3.bench.ts` |

Rules:

- A slow essential test stays P1. Make its fixture faster; do not reclassify it as P2 because it is slow.
- If you are unsure how important a new behavior test is, start with P1.
- One file has one priority. Split a file that mixes priorities, and keep tests with the same owner, priority and fixture together.
- Keep each behavior in one place. A focused test proves the detailed rules. A browser test proves that the user interaction reaches those rules.
- Put focused tests next to the code. Stories stay next to components. Component browser tests live under `packages/canvas-tests/src/ui/<owner>/`. App and packaged journeys live in `packages/e2e`.
- Fixtures end in `.fixture.ts` or `.test-fixture.ts`. Scale tools with no release contract end in `.diagnostic.ts`.

### Run tests locally

From the repository root:

```sh
bun test:p0                         # all P0 tests on this machine
bun test:p1 --scope pstdio-api      # one workspace (name or folder; comma-separated for several)
bun test:p1 --runner component      # one kind of runner
bun test:p2 --list                  # print the plan without building or running
```

Each command builds what the selected tests need, then runs exactly that priority. An empty selection fails. CI adds `--prebuilt` because it builds first. Browser and desktop tests need their system prerequisites installed. Component tests use built Canvas previews. For manual app checks, use `bun run dev:playwright` and stop it with `bun run dev:playwright:down`.

A local run only proves your own machine. It does not prove other platforms or signed release files. See [the testing guide](0002-testing.md) for fixtures, isolation and time limits.

## Stage summary

| Stage | Trigger | Workflow | What runs | Success means | Target time |
| --- | --- | --- | --- | --- | --- |
| Pull request | Push to a PR branch | Test and Build (`pull_request`) | Affected P0, lint, types and public contracts, plus added or edited tests at every priority | The baseline and edited tests passed for this PR | under 3 min for the baseline; edited tests add their normal setup and execution |
| Merge queue | Add to queue | Test and Build (`merge_group`) | All P0, P1 source contracts and real dashboard startup smoke | The exact merged commit passed safety contracts and starts | under 8 min |
| Main | Queue merges a commit | Test and Build (`push`) | Checks that main matches the tested queue commit, publishes the build cache, runs a startup smoke test | Main is the commit the queue tested, and it still starts | a few min |
| Nightly | 03:00 UTC daily, or manual `nightly` | Release Packages → Production validation | P0–P2 on all hosts including Windows, P3 performance, coverage, signed apps for Linux and Apple Silicon | Nightly published; full results recorded for that commit | 40–50 min of execution |
| Stable release | Manual `stable` | Release Packages → Production validation | Everything nightly runs, plus signed desktop apps for Linux, macOS (Intel and Apple Silicon) and Windows, and the Windows update check | A complete certificate for the exact release files allows publishing | 40–50 min of execution |

Prioritize distinct coverage first, then minimize repeated work on frequent runs. Parallel jobs contribute their dependency critical path, not the sum of every runner minute. Report total runner work separately to expose expensive duplication.

Target times count real work: install, build, artifact transfer, tests, reports and cleanup. Time spent waiting in the queue or for a runner is reported separately. A target is never a reason to remove tests or to raise a time limit. See [CI timeouts and performance budgets](../../guidance/0004-ci.md#3-ci-timeouts-and-performance-budgets).

The timing report keeps initial scheduling delay, elapsed time after the first job starts, aggregate runner execution and per-job phases separate. Elapsed-after-start can still include later runner scheduling gaps; use the dependency path and phase timings when assessing the execution targets. Release duration includes certification and publication after the functional gate.

`ci_passed` is the only required check, on PRs and in the queue. It passes only when `validation_results` saw every selected job finish successfully.

## Pull requests

- CI uses the complete diff from the PR base to the checked-out candidate, so tests edited in earlier commits remain selected after another push. It picks the changed workspaces, then adds every workspace that depends on them, including extensions that use released SDK or UI ranges.
- Root build inputs and lockfiles select every workspace. Changes inside `scripts/ci/` select the tooling owner and its declared consumers; the queue still checks all owners.
- A documentation-only change runs only the static checks.
- Added or edited P1, P2 and P3 tests run immediately in required `edited_tests` jobs, alongside the affected P0 checks. P0 tests already covered by the baseline do not run twice. Deleted tests are not executed; their removal still selects affected workspace checks.
- Only test files the PR adds or edits run beyond P0. Helpers, fixtures, runners and test configuration select their workspace's P0 checks, not its P1–P3 tests. The queue runs selected P1 source contracts; complete P1–P3 coverage runs in nightly and stable validation.
- Benchmarks and the service delivery smoke do not run on PRs. Edited benchmark files still run through `edited_tests`.
- Edited tests use their registered runners and setup. Native desktop checks retain all four desktop platforms; packaged CLI and browser checks retain all six toolchain targets. An edited benchmark runs its complete registered suite once per applicable host, preserving its workload and cold-start order. Desktop benchmarks use all four desktop platforms; backend suites use Linux, Apple Silicon and Windows; browser and relay suites use Linux. Existing test limits and performance budgets apply.
- Each selected file runs once per applicable platform. Stable failures block the PR. Quarantined cases retain their separate execution and report requirements. Missing execution evidence fails the check. Jobs preserve selected files, results, traces and measurements as artifacts; independent edited files continue after a failure.
- Complete P1/P2/P3 matrices run in nightly and stable validation. Run relevant integration tests locally before queueing. To get production-level results on a PR, add the `ci:full` label (see [Extra diagnostics](#extra-diagnostics)).
- A new push cancels the PR's older run.

## Merge queue

The `main` ruleset controls the queue:

| Setting | Value |
| --- | --- |
| Required check | `ci_passed` |
| Grouping | ALLGREEN: each entry is tested together with every entry ahead of it |
| Entries built at once | up to 5 |
| Merge method | squash, 1 to 5 entries at a time, after waiting up to 5 minutes for more entries |
| Check timeout | 60 minutes |

The queue runs all P0 checks, P1 API/database/Bun/service-integration contracts, and the existing real dashboard startup smoke on the merged commit. Bun and service-integration contracts share two jobs each, because their setup outweighs their tests. The license, published-extension and public API checks depend only on the files they read, so a queue entry runs them only when its own changes touch those files, as on PRs. Each entry is diffed against the entry ahead of it, which already checked its own changes. Nightly and stable runs always include them. Complete browser, component, CLI and native desktop matrices run in nightly and stable validation. Added or edited tests still run immediately in required PR CI.

This retains fast data-safety and integration coverage before merging while reducing repeated native and browser builds. Browser/native regressions outside the smoke check may first appear after merging. Stable publishing remains blocked until complete validation certifies the exact release candidate.

### When a PR leaves the queue

GitHub records a reason. The **Merge queue removals** workflow adds the `removed-from-queue` label and comments with the reason and, for failed checks, the first failed run. The label goes away when the PR is queued again.

| Reason | Meaning | What to do |
| --- | --- | --- |
| `failed_checks` | `ci_passed` failed for this entry | Open the failed run. Find the first real failure (see below). Fix the cause, then queue the PR again. |
| `stack_invalidated` | A PR this one is stacked on left the queue | Nothing in this PR failed. Queue it again once its base PR is back in the queue. |
| `merge_conflict` | It conflicts with a PR ahead of it | Merge `main` into the branch, then queue it again. |
| `manual` | Someone removed it | Check with that person. |

With ALLGREEN, one failure also forces every entry behind the failed one to rebuild. A single unreliable test therefore delays the whole queue, not only one PR.

### Finding the first real failure

When a P1 job fails, the other P1 jobs stop themselves on purpose (see [Failure handling](#failure-handling)). Their logs say `P1 stopped after <job>`, so a run can show twenty red jobs for one real failure. To find it:

1. Read the `validation_results` log. It lists each failed job.
2. Sort the failures by time. The earliest failed job that is not `validation_results` or `ci_passed` is the cause.
3. If the PR did not touch that code, the test is unreliable. Fix it, or quarantine it, in a separate PR. Do not queue the same commit again and hope it passes.

Causes of unreliable queue failures we have fixed before:

- **A check that changes shared installed files.** Lint and unit checks run in parallel on one runner. A package script that rewrites files in `node_modules` (for example `chakra typegen`) can let another package read a half-written file. Only the CI setup step writes generated declarations; checks only read them.
- **A test that polls for a file its child process writes.** `writeFileSync` creates the file before it writes the content, so the test can read an empty file. Write to a temporary name, then rename it: the rename is atomic.
- **GitHub API limits.** Up to five queue runs and every P1 job read the Actions API. `validation_results` starts after execution jobs finish, so runner queue time does not consume its allowance. It waits through rate limits and GitHub server errors; its existing job time limit bounds those result reads.
- **A corrupt build-cache archive.** See [Builds and caches](#builds-and-caches).

## Main

A push to `main` does not run the tests again. It:

1. Checks that `main` has the same files and build inputs as the queue run that passed. A passing PR never certifies a different merged commit.
2. Publishes the queue's Linux host and browser build archives as the shared build cache.
3. Runs a browser startup smoke test.

A red `main` usually means a startup smoke failure or a cache problem. Fix it before queueing more work.

## Nightly (full validation)

**Release Packages** runs on a schedule at 03:00 UTC, and can be started manually with the `nightly` channel.

- It builds a nightly only if `main` changed since the last published nightly. If `main` did not change, it validates the last nightly's files again.
- It versions the packages on a tag, never on `main`.
- It builds and publishes the npm packages, containers, and signed desktop apps for Linux x64 and Apple Silicon. Nightly publishing does not wait for the deep validation.
- **Production validation** runs on the same files:
  - P0, P1 and P2 on Linux, macOS and Windows, with up to twelve P2 app shards
  - P1 and P2 against the signed desktop apps
  - P3 performance measurements
  - container service checks
  - the packaged CLI on the other five native hosts
  - Windows source diagnostics
- Source line coverage comes from the nightly's P0–P2 Bun jobs. The Coverage workflow publishes only a successful full nightly's measurement. Quarantined tests and P3 are not counted.

A failed validation job does not unpublish the nightly. It makes the run red, `certify` reports the failed checks, and the Coverage workflow skips that nightly's measurement.

P3 budgets describe the hosted CI runners, not a developer machine. Each was set from the slowest result of several runs on the hosted ubuntu-24.04 runner, plus about 20% (see [sidenav and subnav](../../references/performance/0004-sidenav-subnav.md) and [board cold open](../../references/performance/0002-planner-board-cold-open.md)). A fast laptop passes them easily, so a P3 failure on CI is the signal to act on. To change a budget, collect several CI runs of the same candidate first and get the exact value approved (see [CI guidance](../../guidance/0004-ci.md#3-ci-timeouts-and-performance-budgets)).

Fix nightly failures before you start a stable release. The stable release runs the same checks, so the same failure blocks it.

## Stable release (full release)

Start **Release Packages** manually with the `stable` channel.

1. `plan` picks the version and places the release tag.
2. The release files are built once: npm packages, containers, and signed desktop apps for Linux x64, macOS x64, macOS arm64 and Windows x64. The Windows installer also gets an update check.
3. **Production validation** runs everything the nightly runs, against those exact files, on all six native CLI hosts.
4. `certify` writes a certificate. It ties the results to the source commit, version commit, toolchain, producing run and attempt, and the artifact IDs and digests.
5. `publish` runs only if every job passed. It checks the certificate again before it downloads the files. Missing, expired, changed or partial results block publishing.

A source-built Windows nightly diagnostic cannot certify a stable Windows app. Other channels:

- `patch`: fixes for the current stable release without other changes from `main`. Use the `patch-release` skill.
- `packages`: SDK and UI previews only. See [SDK and UI previews](0014-sdk-ui-previews.md).

If a stable release stops halfway, re-run the `publish` job. It skips the steps that already finished.

## Extra diagnostics

- **`ci:full` label.** Runs production functional diagnostics for a same-repository PR through the trusted base workflow. Its `production_ci_passed` result does not replace `ci_passed`. A maintainer runs this for fork PRs.
- **Manual Test and Build.** The `merge_queue` profile repeats the queue checks without a real queue. The `production` profile runs production functional checks from source. Neither publishes anything.
- **Reliability branches.** Pushes to `test/ci-reliability/merge/**` run the queue checks. Other `test/ci-reliability/**` branches run production functional checks.

None of these replace the real queue run or release certification.

## Failure handling

- **P1 stops early.** When a P1 job fails, other P1 jobs stop their own work. They never cancel the whole workflow. [ADR 0108](../../adrs/0108-temporary-cooperative-p1-cancellation.md) explains this temporary design.
- **P0, P2 and P3 finish.** They run all their selected work and report every failure. Matrices with mixed priorities do not use GitHub's fail-fast.
- **A failed setup step blocks the jobs that need it.** It can never let them pass.
- **`validation_results`** starts after all execution jobs finish, then reads the job list from the GitHub API. This avoids occupying a runner and exhausting its allowance while other jobs wait for runners. Individual P1 failures and cooperative stopping remain immediate; the aggregate required result waits for the remaining diagnostics. Missing, duplicated, skipped, cancelled or failed selected jobs fail it. Unselected jobs may skip. If GitHub refuses a read because of a rate limit or a server error, it waits and reads again.
- **`ci_passed`** turns that result into the required check.

### Evidence

- Plan and results: `test-results/ci/gate-results.json`, uploaded as `ci-validation-attempt-<attempt>`.
- Bun and API case reports: `test-results/ci/bun` and `test-results/ci/api`. A passing job without a case report fails. A Bun report that stopped early leaves the remaining cases unknown.
- App and component traces: each package's `test-results` and `playwright-report` folders.

### Quarantine

Quarantine is manual, never automatic. Entries live in `scripts/ci/test-quarantine.json`. Each entry names the runner, file and title, platform, owner, reason, evidence and the condition for removing it.

- Quarantined tests run in their own jobs. Their failures do not block the queue, but each test must still run exactly once.
- A scoped Bun file whose reported cases all belong to the platform quarantine records an unselected stable lane with zero executed cases. The separate quarantine lane must still execute and verify those cases. Empty files, missing reports and unregistered skipped cases cannot use this handoff.
- Retries are not allowed: no rerun flags, no per-test retries, no retries hidden in helpers.
- Run them locally with `bun scripts/ci/run-quarantined-tests.ts bun` and check the reports with `bun scripts/ci/verify-quarantine-reports.ts bun`. The runner also accepts `packaged-bun`, `playwright-ui`, `playwright` and `packaged-desktop`, and `--scope <workspace>`. Pass the check the same runner and scope as the run, because it expects a report from every owner in that scope. A P0 test compares each workflow job's run and check steps.
- Keep the first failed attempt before a rerun. A later pass does not explain the failure.

## Builds and caches

- CI reuses dependency downloads and Nx build archives. It never reuses test results.
- Build inputs include production source and dependencies, the lockfile, build helpers, toolchain, OS, CPU and relevant environment. Changing only tests does not rebuild production code.
- Only `main` publishes the shared certified Linux host and browser build cache, and only after it matches the queue run. Each job's archives are downloaded into their own folder, then imported one at a time: the same Nx hash can have different tar details on different runners, and parallel extraction can corrupt a file.
- A missing cache entry runs the build. A failed build skips the tests that need it.
- If a corrupt archive was published, delete those exact cache entries before you test the fix. Keep the failing logs and note which run produced the archive. A cache problem never justifies changing a test or its priority.

Package-check jobs use shallow checkouts because they read the current source tree; scope/static jobs keep the history required for comparisons and provenance.

P0 package rows build their packages and dependencies once, then run lint and unit checks side by side. These checks call package scripts directly so Nx cannot rebuild a dependency while tests read it. API and database tests have a separate row for each priority. API test files keep a fresh process each, with at most two at once. A file that needs the whole process pool uses `.exclusive.p1.test.ts` and runs alone ([ADR 0018](../../adrs/0018-temporary-api-test-process-isolation.md)).

## Changing the CI setup

Before treating a CI design change as done:

1. Measure representative changes (source, SDK/UI, extension, tooling, native) with cold and warm caches.
2. Check that an early P1 failure stops P1 while P0 finishes and keeps its evidence.
3. Check that missing, duplicated, skipped, cancelled and superseded jobs, and failed setup, never pass.
4. Check P2 and P3 failures, signed and native targets, a changed candidate, and a rejected publication.
5. Run the real queue-to-main path and compare first-attempt work time with the targets. Report waiting time separately.

Keep `ci_passed` and ALLGREEN. Read the live ruleset before you change it. If a change makes CI worse, restore the last working workflow and scripts, remove old queue entries and test fresh ones. Never weaken protection, or reuse a green result from another commit, to make a rollback look successful.
