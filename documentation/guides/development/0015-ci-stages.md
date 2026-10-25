# CI stages and qualification

CI separates fast change feedback, merge safety, and release certification. The implementation lives in `.github/workflows/test-and-build.yml`, `scripts/ci/test-policy.ts`, and `scripts/ci/pull-request-ci-scope.ts`. [ADR 0106](../../adrs/0106-prioritize-merge-checks-and-certify-release-candidates.md) records the decision.

## Stage guarantees

| Stage | Selected work | Success means |
| --- | --- | --- |
| Pull request | Affected P0 static/unit/type/lint/smoke checks and focused P1 owner regressions | Every selected check passed for that merge commit |
| Merge queue | All Linux/macOS P0/P1 contracts, native startup and delivered-default integrity | The actual candidate passed the complete merge-safety plan |
| Main | Successful queue tree/input provenance and a small app smoke run | The merged tree matches tested queue content and still starts |
| Production functional | P0/P1 plus comprehensive P2 permutations and Windows | Every selected functional platform and matrix row passed |
| Production certification | Functional validation plus signed-app and P3 performance evidence for one immutable candidate | Complete, matching evidence permits stable publication |

PR, queue, and complete production targets are less than 180, 480, and 2,400 seconds of active execution. Include installation, builds, artifact transfer, tests, reports, and cleanup. Report GitHub queue and runner wait time separately; it does not count against these targets. These are qualification targets; local test timings do not establish them.

P0 owns fast checks. P1 owns merge-critical functional contracts and is the default for unknown functional work. P2 owns production breadth and Windows. P3 owns timing, memory, throughput, and stress measurements. Slow tests do not automatically belong to P2.

## Read the selected plan

`scope` reads workspace manifests before installing dependencies. It follows dependency names, including released SDK/UI dependency ranges, and explicit Nx dependencies. The PR diff compares the synthetic merge commit with its target parent.

The scope summary records selected packages, API/database files, browser families, component checks, exact matrix names, priorities, and selection reasons. Shared tooling inputs select broad fast checks. A focused API/database change uses adjacent or nearest-owner tests, with a whole-package fallback when no narrower owner exists.

P0 package checks use up to four balanced groups of selected owners. Each group builds its packages and dependencies once, then runs lint and unit checks concurrently. A lint failure does not suppress unit results. Test results are never cached.

Large focused selections split into disjoint rows of roughly 100 API files or 25 database files, capped at the existing four API or three database shards. The smaller database rows reflect its sequential workload. Every selected file still runs.

Read `test-results/ci/gate-results.json` in the `ci-validation-attempt-<attempt>` artifact for the selected graph and observed outcomes. Selected missing, duplicated, skipped, cancelled, or failed required jobs cannot pass. Intentionally unselected jobs may skip. Unplanned executed jobs are reported rather than silently ignored.

## Failure and cancellation

P1 alone fails fast. Bun uses `--bail=1`; app/component Playwright uses `maxFailures=1`; the API scheduler stops pending files and waits for active children to stop. Pure P1 matrices can use GitHub matrix fail-fast.

P0, P2, and P3 stream each failure and finish selected independent work. Mixed production client matrices disable matrix-wide fail-fast. Their Windows rows run as P2 and ignore P1 peer failures. Setup prerequisites can leave their dependent tests blocked; a blocked test is not a successful execution.

`validation_results` runs alongside the test jobs and reports P1 failure promptly. `ci_passed` depends on that result, not on every long-running diagnostic job. Its existing five-minute allowance is unchanged; the monitor has a separate 40-minute execution allowance. Production aggregation waits for the complete selected graph, including P2 and P3 results.

P1 supervisors read the current run attempt's results before commands start and every 15 seconds. They stop only their own P1 work. They do not call workflow cancellation. [ADR 0108](../../adrs/0108-temporary-cooperative-p1-cancellation.md) explains the temporary GitHub limitation, polling delay, setup limitations, and removal criteria.

A superseding PR revision may cancel the older PR run through the existing concurrency rule. That is distinct from cancelling diagnostics because a P1 test failed. Inspect the actual run/attempt and cancellation evidence when diagnosing either event.

## App and component ownership

App browser workflows stay in `packages/e2e`. Their queue suite has six shards and never builds, starts, or waits for Storybook. Use the documented isolated app runtime for manual validation.

Component interactions live in private `packages/storybook-tests`. Three independent owner jobs build and cache the UI, dashboard, and workbench Storybooks. Browser jobs restore those exact archives without building or starting the application API or database. PRs use up to three focused browser shards; the queue runs the complete suite in three shards. Stories remain beside their owning components. App and component jobs can run concurrently.

PR component checks select the complete spec families related to changed owners. Shared inputs use seven existing interaction cases for menus, dialogs, resource actions, tabs, and session navigation. Unknown component paths receive their owner's essential interactions with an explicit selection reason. The scope summary lists selected files and reasons; the runner validates their JSON and passes files directly to Playwright. Small selections use one browser job, with up to three shards for broader changes. Queue and production keep every discovered component spec as P1; this PR selection does not reclassify slow behavior as P2. Extension manifest edits alone do not select component browser tests through reverse dependencies. Type checks and component server helper tests remain P0.

The queue also checks essential built CLI startup, desktop startup, and delivered defaults on Linux/macOS. Production runs all six native CLI targets: Linux x64/arm64, macOS x64/arm64, and Windows x64/arm64. Signed desktop functional and performance validation use the candidate's Linux x64, macOS x64/arm64, and Windows x64 publication inputs; nightly Windows source diagnostics are identified separately.

Packaged `integrity` verification assigns the portable public package contract family once to Linux P1 in the queue. That family compares source and published declaration exports, installs the SDK/UI/workbench tarballs, checks TypeScript 6 and Bun types, loads React-free exports with default and source conditions, runs storage and provider-reference consumers, and builds React/Vite consumers with Monaco assets. These fixtures target the same portable JavaScript and declarations and contain no operating-system or architecture branches. Every selected native queue host still checks its binary files and runs embedded Bun install, build, test, valid and invalid type checks, and dependency executables with an empty `PATH`. The `full` production profile repeats the same public contract family on all six native hosts as P2, preserving installer, filesystem, and toolchain permutations. Local verification defaults to `full`; `--prebuilt` keeps the tested binary unchanged.

Compiled feature contracts live in separate test files so Bun can divide them between two CLI jobs. Packaged browser contracts use three independent Playwright shards. Vite terminal validation has its own row. These rows keep the complete selected workload and do not wait for one another's tests.

## Request deeper diagnostics

`ci:full` requests separate full functional diagnostics for a same-repository PR. A trusted `pull_request_target` label handler dispatches the trusted base-branch Test and Build workflow with `profile=production` and the exact PR merge SHA as `source_sha`. The diagnostic result is `production_ci_passed`; it does not replace or delay the ordinary required `ci_passed` PR gate.

The trusted handler does not execute PR code itself. Fork PRs receive an explicit instruction to request manual diagnostics from a maintainer; they are not automatically dispatched into this internal-branch path.

Full functional diagnostics do not certify a release artifact and do not replace P3 qualification. For manual source diagnostics, use Test and Build's production profile with the exact reviewed source revision. For an immutable candidate, dispatch Production validation with its version commit, original source commit, producing run and attempt, and channel:

```bash
gh workflow run production-validation.yml --ref main \
  -f ref=<version-sha> -f source_sha=<original-source-sha> \
  -f artifact_run_id=<producer-run-id> -f artifact_attempt=<producer-attempt> \
  -f channel=stable
```

Use the same workload and limits as automatic production validation. A focused or source-only diagnostic is not a complete release certificate.

## Candidate and publication identity

Production validation checks one immutable candidate. Original source SHA and generated version SHA are separate fields. Consumers bind evidence to their actual checkout and toolchain, policy digest, producer run/attempt, artifact IDs and digests, and test outcome.

A certificate is complete only when every required functional and performance result exists once and matches that candidate. Stable publication also requires `releaseEligible` and rechecks the candidate before downloading the certified artifacts by immutable ID. Changed or expired artifacts, changed policy/toolchain, stale source, missing outcomes, and partial diagnostics block stable publication.

Daily nightly publication retains basic artifact integrity and all-or-nothing publishing. Deep P2/P3 jobs run independently; their failures do not delay that nightly publication. Stable publication waits for matching complete certification. An explicitly source-built nightly Windows diagnostic cannot certify a stable published Windows app.

The separate Service containers PR workflow runs pure contract checks and Terraform validation. Runtime image builds belong to release production or manual diagnostics. Producers check the built image, pinned Bun runtime, and public module export. Production validation runs the full deployment smoke against those exact image archives. The complete queue still owns its merge-critical relay and account contracts.

Numeric operation budgets and fixed workloads remain with their benchmarks. Test execution allowances are separate. No timing target authorizes increasing either. Scale diagnostics without an approved ceiling remain visible diagnostics; they must not gain an invented threshold. See the [testing guide's time limits](0002-testing.md#time-limits).

## Cache and generated outputs

Reuse dependency downloads and Nx build archives, never passing test results. Nx keys include source/dependency inputs, lockfile, compiler/build helpers, runtime toolchain, OS/architecture, and relevant build environment. Regenerate installed Chakra declarations outside the task cache. Run committed-output `git diff --exit-code` checks after builds, including cache hits.

Queue host producer archives are uploaded after build work, including native desktop and toolchain jobs. Native dependency installation restores downloads before applying its Node-header setup. Main first verifies matching successful queue provenance, then promotes the archives into Linux and both macOS architecture cache namespaces. Each Nx record also hashes its actual OS, architecture, Bun and Node versions. Main's browser/container cache is saved after its actual build. A miss runs the required producer builds normally.

The main provenance check compares the merged tree and build inputs with successful queue evidence. It does not treat a passing PR result as proof of a different merged tree.

## Case and failure evidence

Bun/API reports live under `test-results/ci/bun` and `test-results/ci/api`; owning jobs upload them even on failure. Reports include the actual source revision, package/platform, priority, stable case IDs, executed/skipped outcomes, exact API file selection, cancellation, missing reports, and timing metadata.

A bailed Bun JUnit report omits later cases. Its unreported selected-case count remains unknown, and its execution report stays partial. Missing reports cannot become success. Quarantine registration and report validation remain explicit; no runner automatically quarantines or retries failed cases.

App reports/traces live under `packages/e2e/{test-results,playwright-report}`. Component evidence lives under `packages/storybook-tests/{test-results,playwright-report}`. Production jobs also retain machine/workload metadata and exact consumer attestations. Retain first-attempt evidence before any manual rerun; a later pass does not close the underlying failure.

## Qualification and rollback

Local evidence recorded for this change includes 6,566 unit cases, 173 discovered app cases, 127 component browser cases, and full packaged verification. Those figures describe the local work performed. They do not prove complete Windows/release execution, fleet capacity, or the three wall-time targets.

Before marking the architecture qualified:

Use Test and Build's manual `merge_queue` profile for source-only queue rehearsals. Pushes to `test/ci-reliability/merge/**` also select that profile; other `test/ci-reliability/**` branches select full functional diagnostics. These runs do not publish releases or replace a real merge-group qualification run.

1. Run representative source, SDK/UI, extension, tooling, and native changes through hosted PR and queue profiles. Include cold and warm cache paths and historically failing merge interactions.
2. Inject a controlled early P1 failure beside slower P0 work. Verify the required failure appears promptly and P0 finishes and uploads its reports. Check actual merge-queue lifecycle behavior, not only local child-process fixtures.
3. Exercise missing/duplicate/skipped matrix rows, API setup failure, P1 cancellation, external cancellation, and superseded attempts. None may yield required success.
4. Exercise independent P2 and P3 failures, signed/native targets, source-diagnostic classification, candidate mismatch, changed artifact digest, and stable-publication rejection.
5. Compare full wall time and first-attempt outcomes with the targets. Do not reduce workloads, raise allowances, or retry failures to pass qualification.

`ci_passed` remains the existing required context. No manual replacement check name or weaker branch rule is needed. Inspect the live ruleset and check identity, retain ALLGREEN, and handle existing queued candidates explicitly when the implementation changes.

If qualification fails, revert to the last qualified workflow/selection implementation while preserving `ci_passed` and ALLGREEN. Remove stale candidates and queue fresh candidates under that restored plan. Keep stable publication blocked until its matching certificate passes. Do not disable protection or reuse a green result from a different tree as a rollback shortcut.
