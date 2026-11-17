# CI stages

This guide explains how a change moves from a pull request to a stable release, and which tests run at each step. [ADR 0149](../../adrs/0149-share-required-checks-and-own-platform-coverage.md) records why CI is split this way.

```text
pull request ──► merge queue ──► main ──► nightly (daily) ──► stable release (manual)
 shared profile  same profile   smoke     Linux + native      exact shipped artifacts
```

The required profile has a ten-minute maximum turnaround target. Qualification is pending until representative cold and warm PR and actual merge-group runs pass. Native and release durations have separate targets.

Each stage has its own purpose. A later stage never trusts a result from a different commit: the queue tests the exact merged commit, and a release tests the exact files it will publish.

## Test priorities

Every test file names its priority before the runner suffix, for example `session-state.p0.test.ts`. Priority describes importance; the coverage catalog separately owns platform applicability. PR and queue selection use the same policy and include affected behavior and edited tests. P3 workloads stay in dedicated nightly/release validation.

| Priority | What it protects | Runs in | Examples |
| --- | --- | --- | --- |
| P0 | Fast rules: types, validation, permissions, state changes, focused extension logic, repository and CI rules | Pull request, queue, nightly, stable | `session-state.p0.test.ts` |
| P1 | Essential product behavior: session, workspace and extension lifecycles, data safety, restart and upgrade, sync, a working app, native and compiled startup | PR/queue for affected source contracts and packaged smoke; complete suites in nightly/stable | `session-isolation.p1.test.ts`, `startup.p1.spec.ts` |
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

For review readiness, use the [targeted local review command](0002-testing.md#targeted-local-review). It replaces the mandatory full local suite while running at least the merge queue’s entire test selection, plus changed-behavior coverage. Required PR, queue and release CI coverage remains unchanged.

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
| Pull request | Push to a PR branch | Test and Build (`pull_request`) | All fast P0 units, affected source contracts, static/type checks, one Linux desktop package, smoke and affected packaged flows | The selected profile passed on this candidate | at most 10 min; qualification pending |
| Merge queue | Add to queue | Test and Build (`merge_group`) | The same required profile on the actual merged tree and combined diff | The exact merged candidate passed | at most 10 min; qualification pending |
| Main | Queue merges a commit | Test and Build (`push`) | Checks that main matches the tested queue commit, publishes the build cache, runs a startup smoke test | Main is the commit the queue tested, and it still starts | under 8 min |
| Nightly | 03:00 UTC daily, or manual `nightly` | Release Packages → Production validation | P0–P2 on Linux, with focused native checks on Apple Silicon and Windows x64; all eight P3 benchmarks on Linux x64, Apple Silicon and Windows x64, coverage, signed apps for Linux and Apple Silicon | Nightly published; full results recorded for that commit | 40–50 min of execution |
| Stable release | Manual `stable` | Release Packages → Production validation | Everything nightly runs, plus Windows and Intel macOS: signed desktop apps, packaged CLI hosts, focused Windows process/security and filesystem/storage contracts, the same three-host benchmark matrix, and the Windows update check | A complete certificate for the exact release files allows publishing | 40–50 min of execution |

Prioritize distinct coverage first, then minimize repeated work on frequent runs. Parallel jobs contribute their dependency critical path, not the sum of every runner minute. Report total runner work separately to expose expensive duplication.

Target times count real work: install, build, artifact transfer, tests, reports and cleanup. PR and queue targets start at workflow creation and include runner waits, setup, builds, reports and gate cleanup. Runner waits are also reported separately. A target is never a reason to remove tests or to raise a time limit. See [CI timeouts and performance budgets](../../guidance/0004-ci.md#3-ci-timeouts-and-performance-budgets).

The timing report keeps initial scheduling delay, elapsed time after the first job starts, aggregate runner execution and per-job phases separate. Elapsed-after-start can still include later runner scheduling gaps; use the dependency path and phase timings when assessing the execution targets. Release duration includes certification and publication after the functional gate.

`ci_passed` is the only required check, on PRs and in the queue. It passes only when `validation_results` saw every selected job finish successfully.

## Pull requests

- PR scope compares the checked-out merge candidate with its actual first parent. Merge groups compare with `merge_group.base_sha`, covering every combined change in the group.
- Both stages run all fast P0 units. Source P1 contracts follow production owners and their dependants. Lockfiles and shared build inputs select all owners. Static/public checks follow the files they read.
- Both stages build one unsigned Linux desktop package, then run packaged startup and affected desktop flows. Relative helper/fixture imports select consuming flows even when no test file changed. Existing Linux compiled-runtime/browser flows remain explicit coverage owners until their Electron replacements pass; an external browser pass is not a desktop pass.
- The compact source dashboard smoke remains a source integrity contract. Complete source app/component, native and browser-engine matrices stay outside the routine required profile.
- Edited behavior tests use their registered Linux runners. Native-only changes can use focused diagnostics. Edited benchmarks retain their dedicated nightly/release workload and budgets.
- A documentation-only PR has the same fast baseline and mandatory packaged smoke, without affected feature journeys. Local prose-only work can still use scoped verification without invoking the review command.
- Scope seals the exact selected files, target, source and policy into the immutable plan. Missing execution, setup failure or a missing selected job fails the gate. Quarantine retains its case identities and separate evidence rules.
- A new push cancels the older PR run. `ci:full` and `ci:windows` request separate diagnostics; they do not replace required candidate validation.

## Merge queue

The `main` ruleset controls the queue:

| Setting | Value |
| --- | --- |
| Required check | `ci_passed` |
| Grouping | ALLGREEN: each entry is tested together with every entry ahead of it |
| Entries built at once | up to 5 |
| Merge method | squash, 1 to 5 entries at a time, after waiting up to 5 minutes for more entries |
| Check timeout | 60 minutes |

The queue applies the PR policy to its actual merged tree and the entire combined change scope. It executes fresh tests; a prior PR pass never certifies a different tree. License, published-extension and public API checks use that same combined diff. No broad Windows/macOS or browser matrix is added at the queue stage.

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
3. If the PR did not touch that code, the test is unreliable. Fix it in a separate PR. Remove a failing quarantined case and keep the evidence for restoring coverage after a fix. Do not queue the same commit again and hope it passes.

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
  - P0, P1 and P2 on Linux, with up to twelve P2 app shards; native desktop and packaged CLI checks also run on Apple Silicon
  - P1 and P2 against the signed desktop apps. When the run validates signed release files, the source desktop jobs keep only the source Electron checks, so each packaged desktop case runs once.
  - P3 performance measurements
  - container service checks
  - native artifact contracts on Linux x64, Apple Silicon and Windows x64; full shared CLI behavior runs separately on Linux
- B1–B8 each run once on Linux x64, Apple Silicon Mac and Windows x64: 24 combinations. Intel Mac is excluded from benchmarks. Windows desktop measurements use an unpublished production-mode package in nightly validation and the signed candidate in stable validation.
- Windows runs focused source/native contracts and an unpublished packaged desktop diagnostic. Intel macOS and the other secondary CLI architectures have weekly compatibility diagnostics and exact-artifact checks in stable releases. Signed installation/update certification belongs to the release path.
- The shared Bun unit, API and database suites run on Linux. Apple Silicon runs the desktop app's own Bun tests, the native desktop and packaged CLI checks, and the Bun quarantine lane.
- Source line coverage comes from the nightly's P0–P2 Bun jobs. The Coverage workflow publishes only a successful full nightly's measurement. Quarantined tests and P3 are not counted.

A failed validation job does not unpublish the nightly. It makes the run red, `certify` reports the failed checks, and the Coverage workflow skips that nightly's measurement.

P3 budgets describe the hosted CI runners, not a developer machine. Each was set from the slowest result of several runs on the hosted ubuntu-24.04 runner, plus about 20% (see [sidenav and subnav](../../references/performance/0004-sidenav-subnav.md) and [board cold open](../../references/performance/0002-planner-board-cold-open.md)). A fast laptop passes them easily, so a P3 failure on CI is the signal to act on. To change a budget, collect several CI runs of the same candidate first and get the exact value approved (see [CI guidance](../../guidance/0004-ci.md#3-ci-timeouts-and-performance-budgets)).

Fix nightly failures before you start a stable release. The stable release runs the same checks, so the same failure blocks it.

## Stable release (full release)

Start **Release Packages** manually with the `stable` channel.

1. `plan` picks the version and places the release tag.
2. The release files are built once: npm packages, containers, and signed desktop apps for Linux x64, macOS x64, macOS arm64 and Windows x64. The Windows installer also gets an update check.
3. **Production validation** runs everything the nightly runs, against those exact files, and adds Windows and Intel macOS: all six native CLI artifact contracts, with shared CLI journeys on Linux, focused Windows process/security and filesystem/storage contracts, and exact signed Windows benchmark artifacts. Benchmark coverage is B1–B8 on Linux x64, Apple Silicon Mac and Windows x64 in both channels; Intel Mac has no benchmark lane.
4. `certify` writes a certificate. It ties the results to the source commit, version commit, toolchain, producing run and attempt, and the artifact IDs and digests.
5. `publish` runs only if every job passed. It checks the certificate again before it downloads the files. Missing, expired, changed or partial results block publishing.

A source-built diagnostic cannot certify a stable release app. Other channels:

- `verify`: build and validate the current Changesets version candidate without placing a release tag, publishing, or updating the version PR. Supply the full Version Packages commit as `source_sha`; its parent records the original source. It uses the complete stable platform matrix, signing, Windows update checks, and exact-artifact certification. Run the workflow from `main` to retain signing trust. Reports and candidate build artifacts remain available on the run.
- `patch`: fixes for the current stable release without other changes from `main`. Use the `patch-release` skill.
- `packages`: SDK and UI previews only. See [SDK and UI previews](0014-sdk-ui-previews.md).

If a stable release stops halfway, re-run the `publish` job. It skips the steps that already finished.

## Extra diagnostics

These expensive workflows are exceptions, not routine PR requirements. Use them only for a concrete high-risk change that focused local checks and normal PR CI cannot establish, or an explicit user request. Record the risk and smallest complete workload first. Deferred inventory entries and shared dependency changes do not automatically justify a full matrix. Nightly and release validation retain their declared complete coverage.

- **`ci:full` label.** Runs production functional diagnostics for a same-repository PR through the trusted base workflow. Its `production_ci_passed` result does not replace `ci_passed`. A maintainer runs this for fork PRs.
- **`ci:windows` label.** Runs Windows-only source diagnostics for the exact same-repository PR merge commit. Includes the two focused Windows source groups, native desktop contracts and x64/ARM64 CLI artifact contracts, Windows harness checks and Bun quarantine evidence, plus repository static checks. Reports `windows_ci_passed`; it does not replace either the fast PR gate or full production/release certification. The label runs once when added; remove and re-add it to test a new head. Forks require maintainer dispatch of a reviewed repository ref.
- **Manual Test and Build.** The `merge_queue` profile repeats the queue checks without a real queue. The `production` profile runs production functional checks from source; `windows` selects the Windows lanes only, and `macos` selects Apple Silicon and Intel native desktop/CLI contracts plus Mac quarantine evidence. The Mac diagnostic excludes Linux shared journeys and Windows jobs. These profiles publish nothing. A newer manual run for the same branch and `source_sha` cancels the older one.
- **Reliability branches.** Pushes to `test/ci-reliability/merge/**` run the queue checks. Other `test/ci-reliability/**` branches run production functional checks.

None of these replace the real queue run or release certification.

## Failure handling

- **P1 stops early in PR and queue runs.** When a P1 job fails, other P1 jobs stop their own work. They never cancel the whole workflow. Nightly and stable validation (profile `production`) run every P1 job and file to the end, so one run reports every failure. [ADR 0108](../../adrs/0108-temporary-cooperative-p1-cancellation.md) explains this temporary design.
- **P0, P2 and P3 finish.** They run all their selected work and report every failure. Matrices with mixed priorities do not use GitHub's fail-fast.
- **A failed setup step blocks the jobs that need it.** It can never let them pass.
- **`validation_results`** starts after all execution jobs finish, then reads the job list from the GitHub API. This avoids occupying a runner and exhausting its allowance while other jobs wait for runners. Individual P1 failures and cooperative stopping remain immediate; the aggregate required result waits for the remaining diagnostics. Missing, duplicated, skipped, cancelled or failed selected jobs fail it. Unselected jobs may skip. If GitHub refuses a read because of a rate limit or a server error, it waits and reads again.
- **`ci_passed`** turns that result into the required check.

### Evidence

- Scope saves one immutable `test-results/ci/plan.json`. Workers consume assigned run IDs; downloaded native reports are reconciled in `plan-verification.json`. The existing required-job result remains `gate-results.json`, uploaded as `ci-validation-attempt-<attempt>`.
- Planned case reports: per-run directories beside `execution.json` in `test-results/ci/planned`. A passing process without matching native case evidence fails. A report that stopped early leaves remaining execution unknown.
- App and component traces: each package's `test-results` and `playwright-report` folders.

### Quarantine

Remove failing quarantined cases and their matching entries from `scripts/ci/test-quarantine.json`. Preserve first-failure evidence in the ticket or report; restore product coverage after fixing the cause. Do not turn a failing quarantine into a stable test or a permanent skip.

The registry is currently empty. Quarantine execution remains available for focused diagnosis. Registered diagnostic cases must run once in their separate lane with native evidence. Setup failures, missing cases or reports, cancellation, skipped cases, and retries fail verification. A stable pass does not establish that a diagnostic case passed.

## Builds and caches

- CI reuses dependency downloads and Nx build archives. It never reuses test results.
- Build inputs include production source and dependencies, the lockfile, build helpers, toolchain, OS, CPU and relevant environment. Changing only tests does not rebuild production code.
- Only `main` publishes the shared certified Linux host and browser build cache, and only after it matches the queue run. Each job's archives are downloaded into their own folder, then imported one at a time: the same Nx hash can have different tar details on different runners, and parallel extraction can corrupt a file.
- Each run builds its Linux host packages once, in `build_host`. Package checks, database tests and contracts import its archives before their own build step, so each package builds once per run. A build failure in `build_host` does not stop those jobs: each rebuilds what is missing and reports its own failure.
- A missing cache entry runs the build. A failed build skips the tests that need it.
- Every workflow pins one exact Node version. Main compares the queue run's Node version with its own, and runner images cache different patch releases, so a loose version can make main red without any code change.
- If a corrupt archive was published, delete those exact cache entries before you test the fix. Keep the failing logs and note which run produced the archive. A cache problem never justifies changing a test or its priority.

Package-check jobs use shallow checkouts because they read the current source tree; scope/static jobs keep the history required for comparisons and provenance.

P0 package rows build their packages and dependencies once, then run lint and unit checks side by side. These checks call package scripts directly so Nx cannot rebuild a dependency while tests read it. API and database tests have a separate row for each priority. API test files keep a fresh process each, with at most two at once. A file that needs the whole process pool uses `.exclusive.p1.test.ts` and runs alone ([ADR 0018](../../adrs/0018-temporary-api-test-process-isolation.md)). A file still running after 5 minutes counts as stalled: the runner fails it and saves the states, threads, wait channels, open files and kernel stacks of its processes to `files/<index>/stall.txt` in the job's `test-results/ci/api` artifact (macOS saves `sample` output; Windows records nothing). Bun's per-test timeout cannot stop a test that blocks its own process. A stalled or cancelled file's whole process tree is killed, because a blocked `bun test` survives its wrapper.

## CI health report

The **Weekly CI failure report** runs every Sunday at 21:17 UTC and covers the previous seven days. Besides failing tests and steps, it reports:

- p50 and p90 time per stage against the 10, 10, 8 and 40 minute targets for PRs, the queue, main and release validation. Only first attempts whose required gate passed or failed count; superseded, approval-pending and gate-less runs are left out.
- runner minutes per stage, including reruns
- queue runs per merged PR
- the share of failed jobs that passed when rerun on the same commit. A gate job counts only when nothing else in its attempt failed.
- the quarantine size, and the entries added more than 30 days ago. Entries are not removed automatically.

Every workflow shares the token's 1,000 API requests per hour, and a busy week needs about 2,700. The collector keeps 300 requests in reserve for other workflows and waits for each reset, so the job can take over four hours. It reads failure logs only for queue, main, release and diagnostic runs. The data is uploaded as the `ci-failure-report-attempt-<attempt>` artifact; `health.json` holds the health figures. To report another window, run `bun scripts/ci/report-ci-failures.ts --since <date> --until <date>`.

## Changing the CI setup

Before treating a CI design change as done:

1. Measure representative changes (source, SDK/UI, extension, tooling, native) with cold and warm caches.
2. Check that an early P1 failure stops P1 while P0 finishes and keeps its evidence.
3. Check that missing, duplicated, skipped, cancelled and superseded jobs, and failed setup, never pass.
4. Check P2 and P3 failures, signed and native targets, a changed candidate, and a rejected publication.
5. Run the real queue-to-main path and compare first-attempt work time with the targets. Report waiting time separately.

Keep `ci_passed` and ALLGREEN. Read the live ruleset before you change it. If a change makes CI worse, restore the last working workflow and scripts, remove old queue entries and test fresh ones. Never weaken protection, or reuse a green result from another commit, to make a rollback look successful.

## Coverage ownership and qualification

[`coverage-ownership.ts`](../../../scripts/ci/coverage-ownership.ts) owns integration applicability. Shared navigation, Planner and editing flows have one Linux owner. Native shell, drive, locking, process ownership and install behavior stays on its OS. Mixed native files retain their native assertions until a replacement is extracted and qualified. The Intel Mac desktop runs the retained startup/recovery smoke. The failing startup/persistence cases, including their Intel terminal assertion, were removed with the quarantine cleanup; their earlier validation does not certify the retained coverage.

Daily native diagnostics include an unpublished Windows desktop package; nightly publication still contains only Linux and Apple Silicon apps. Stable validation consumes every shipped target's exact bytes. Certificate names distinguish `desktop-shared-linux-x64` from `desktop-native-<target>` and the policy digest includes the selection and execution code. Surviving P3 cases keep their existing workloads and budgets. Failing quarantined P3 cases were removed; their coverage gaps are recorded in [the quarantine decision](../../adrs/0101-temporary-flaky-test-quarantine.md). Installation/update verification and signature checks retain their existing contracts.

Measure a completed first-attempt run with `bun scripts/ci/required-turnaround.ts <run-id> cold` or `warm`. Preserve the cache provenance with the report. The JSON records workflow creation through required-gate completion, runner waits when GitHub provides creation timestamps, and individual job/step timings. Unknown cache provenance, incomplete or failed runs, reruns and overruns cannot qualify the ten-minute target. Do not omit selected tests or raise allowances to pass it.

Before accepting a migration, retain an inventory of old and new files/cases and their exact Linux/native replacements. Run representative cold and warm PR and actual merge-group candidates, plus the final published-artifact contracts. Restore a family's previous selection if its replacement fails qualification. Hosted qualification, migration of remaining browser-driven shared journeys to Electron, mixed native case extraction must remain visible until verified; local planner passes do not establish them.
