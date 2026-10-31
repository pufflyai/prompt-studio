# Prioritize merge checks and certify release candidates

Proposed: 2026-10-25

Status: Accepted. Implementation is subject to hosted qualification. Supersedes the CI stage decisions in [ADR 0087](0087-run-relevant-pr-checks-before-merging.md) and the stage and release-validation placement decisions in [ADR 0072](0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md). ADR 0072's single-commit publication, tag ownership, and all-or-nothing publication rules remain in force.

## Context

The full merge queue repeats long production and performance work before every merge. Relevant PR checks also need a clear promise: a fast regression check is useful, but is not proof of the complete release matrix. Moving checks is safe only when their new destination runs, their outcomes remain required there, and the actual tested inputs are recorded.

The core owns CI for its shared platform and extension contracts. This change does not move tool-specific behavior into the core. It shortens feedback by giving each check one purpose and an explicit owner.

## Decision

Use four priorities. P0 contains fast static, focused unit, type, lint, and public declaration checks. Startup smoke belongs to P1. P1 contains merge-critical functional and integrity contracts; unknown functional work defaults to P1. P2 owns comprehensive production permutations and Windows execution. P3 owns timing, memory, throughput, and stress measurements. A test is not P2 merely because it is slow.

| Stage | Required proof | Target wall time |
| --- | --- | --- |
| Pull request | Affected P0 rules, types, lint and public contracts, plus added or edited tests at every priority | Less than 180 seconds for the baseline; edited tests add normal setup and execution |
| Merge queue | All P0 checks plus real app startup smoke on the actual merge candidate | Less than 480 seconds |
| Main | Matching successful queue provenance and a small app smoke run | No repeated full suite |
| Production candidate | Exact-candidate P0/P1, all required P2 platforms and permutations, and P3 measurements | Less than 2,400 seconds |

These targets measure active execution, including installation, builds, artifact transfer, tests, reports, and cleanup. GitHub queue and runner wait time is reported separately and does not count against the targets. They are targets, not measured results or reasons to omit work. Existing test allowances, benchmark workloads, and numerical performance budgets stay unchanged. Expanded scale diagnostics without approved operation ceilings do not acquire invented limits.

### Selection and execution

Read workspace manifests before installation. Follow dependency names and explicit Nx dependencies, including consumers that declare released SDK/UI ranges. Each test filename declares one priority: `.p0.test.ts`, `.p1.spec.ts`, `.p2.integration.ts`, or `.p3.bench.ts`, for example. Discovery selects affected P0 contracts through owning packages and their consumers for PRs. The required queue runs every P0 contract plus app startup smoke. Complete P1 suites run in nightly and stable candidate validation. This keeps fast local rules and edited tests in PR feedback while moving broad integration work out of the queue. A regression outside P0 or smoke can first be found after merging; stable publication still requires the complete exact-candidate certificate. It rejects unclassified test files. Runner adapters own setup, so workflow files need no test filename lists. The same discovery powers `bun test:p0` through `bun test:p3`. It never drops tests because time has elapsed.

Keep API tests in fresh per-file processes under [ADR 0018](0018-temporary-api-test-process-isolation.md), with at most two active files and the existing 30-second per-test limit. Optional timing metadata balances complete files across shards; it does not reduce the workload.

PR selection uses the complete base-to-candidate diff. Added or edited tests also run as required PR checks at their declared priority, using their registered runners and setup. Test-support edits select their owner's tests. A direct runner entry named by a workspace test script selects its adjacent P0 process contract when present, otherwise that runner's suite; shared helpers and configuration keep the conservative owner-wide fallback. P0 work already covered by the baseline is not duplicated. Native desktop and packaged checks keep their platform matrices; an edited benchmark runs its registered suite once to preserve cold-start order and fixed workloads. Edited-test jobs finish independent selected files after a failure and preserve their execution evidence. Existing quarantine policy, limits and performance budgets remain in force. This exception gives test edits immediate feedback without moving the complete queue or production suites into every PR.

The queue uses the existing real dashboard startup smoke, without native desktop packaging or broad browser/component matrices. Nightly and stable validation retain complete P1/P2 app, component, native, compiled CLI and delivered-default integrity suites and their platform coverage. Component browser checks build and test one source owner and priority together in a browser container. Critical interactions remain P1; comprehensive component permutations remain P2. Moving a suite changes its stage, not its priority, workload or execution allowance.

An internal PR can request separate full functional diagnostics with `ci:full`. A trusted label handler dispatches the base-branch workflow definition with the exact PR merge SHA as its checkout input and reports `production_ci_passed` without replacing the fast required `ci_passed` result. Forks use an explicit maintainer-driven diagnostic path. This functional profile does not stand in for a release certificate or P3 validation.

### Failure policy

P1 alone fails fast. Bun, Playwright, file schedulers, and pure P1 matrices stop their remaining P1 work after a P1 failure. P0, P2, and P3 stream failures and finish selected independent checks before reporting their final result. A failing setup can block its consumers, but cannot turn those consumers into successful tests.

`validation_results` starts after execution jobs finish, then verifies the selected graph through the GitHub API. It rejects missing, duplicate, skipped, cancelled, or failed required outcomes. Individual P1 failures and cooperative stopping remain immediate; aggregate validation waits for remaining diagnostics. `ci_passed` retains its existing check context and five-minute allowance; aggregation retains its 40-minute allowance. Changing a test budget is a separate decision.

Cross-job P1 stopping uses read-only result polling and local process termination, not workflow cancellation. [ADR 0108](0108-temporary-cooperative-p1-cancellation.md) records this temporary platform workaround. Mixed Linux/macOS and Windows matrices disable matrix-wide fail-fast in production so a P1 row cannot cancel a P2 Windows row.

Manual quarantine remains explicit and visible. No failure is automatically quarantined, retried to green, or made optional. Setup failures and incomplete quarantine execution still block their owning stage.

### Inputs and evidence

Record the tested source commit and tree, policy/build inputs, toolchain, selected jobs and exact matrix rows, and their results. Bun runners record JUnit case IDs, executed/skipped outcomes, file selection, missing reports, cancellation, and timings. A bailed JUnit report does not enumerate later cases; its unknown remainder stays explicit.

Build cache entries remain Nx task archives, with source/dependency inputs, lockfile, compiler/build helpers, Bun/Node versions, OS/architecture, and relevant environment in their keys. Cache hits still expose committed generated outputs to `git diff --exit-code`. Never cache a passing test result as proof for another tree.

Queue producer archives can seed later jobs. Main verifies the queue's exact tree and inputs before promoting those build archives to the default-branch cache. Container caches save after their build work. A miss builds the declared producers normally; a cache hit does not remove fresh behavioral checks.

### Publication

Build one immutable candidate and distinguish its original source SHA from its generated version commit. Consumers verify the checkout, build identity, producer run/attempt, artifact IDs and digests, and policy/toolchain. Stable publication downloads the artifacts named by a complete release-eligible certificate and rejects changed inputs or artifact identities.

Daily nightly publication keeps basic artifact integrity and all-or-nothing publication. Deep P2/P3 diagnostics run independently and do not delay nightly publication. Stable publication waits for complete matching functional and performance evidence. A source-built nightly Windows diagnostic is identified as such and cannot certify a stable published Windows app.

## Qualification and consequences

The local qualification record includes runner and gate behavior tests, targeted owning-package checks, all seven critical component browser cases, and 106 relay integration cases using one disposable stack with a separate database per file. These results do not prove that every production platform ran or that any wall-time target was achieved. Hosted measurements remain required.

Hosted qualification must exercise representative source, SDK/UI, extension, tooling, and native changes; cold and warm build paths; an early P1 failure with slower P0 work; missing matrix rows; stale candidates/artifacts; and production P2/P3 failure collection. Preserve first-attempt logs and queue/setup/build/test/report/cleanup timings. A passing rerun does not establish reliability.

The required context remains `ci_passed`, so this change needs no replacement check name or weaker branch rule. Keep the merge queue's ALLGREEN policy. Verify the live check identity and queue behavior before treating the new stages as qualified. In particular, confirm that GitHub's queue lifecycle does not discard surviving P0 evidence after early P1 rejection.

If qualification fails, revert the workflow/selection change to the last qualified gate while retaining the same required context and ALLGREEN queue. Remove stale queued candidates and test fresh candidates under the restored plan. Do not disable the gate, accept an incomplete certificate, or publish stable artifacts to make rollback appear successful.

The operational commands and qualification checklist live in [CI stages](../guides/development/0015-ci-stages.md).
