# Prioritize merge checks and certify release candidates

Proposed: 2026-10-25

Status: Accepted, subject to hosted qualification. Consolidates ADR 0087's CI-stage history. [ADR 0072](0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md) still owns publication atomicity and tag rules.

## Context

- Build-only queues missed regressions. Later full-suite queues repeated expensive production work and let intermittent failures reject good changes.
- From 2026-10-12 to 2026-10-23, only 51 of 200 main runs passed under the earlier stages. Moving coverage requires a declared destination and evidence from the exact tested inputs.

## Decision

P0 owns fast static, focused unit, type, lint, and public declaration checks. P1 owns functional and integrity contracts, including startup smoke; unknown functional work defaults to P1. P2 owns comprehensive production permutations and Windows execution. P3 owns performance, resource use, and stress. Slow tests are not automatically P2.

| Stage | Required proof | Target wall time |
| --- | --- | --- |
| Pull request | Affected P0 and added/edited tests at every priority | Baseline below 180 seconds; edited tests add setup and execution |
| Merge queue | All P0, P1 source contracts, and real-app startup on the merge candidate | Below 480 seconds |
| Main | Matching queue provenance and a small app smoke | No repeated full suite |
| Production candidate | Exact-candidate P0/P1, required P2 platforms/permutations, and P3 | 2,400–3,000 seconds |

Targets count installation, builds, transfers, execution, reports, and cleanup. Report queue/runner waits separately. Targets neither establish achieved performance nor authorize skipped coverage or larger allowances. Existing limits, fixed workloads, and budgets stay unchanged; scale diagnostics acquire no invented ceilings.

## Selection and execution

1. Discover tests by workspace ownership, manifest dependencies, and explicit Nx dependencies, including released SDK/UI consumers. Read manifests before installation. Use the complete base-to-candidate diff.
2. Require one priority in each test filename. Reject unclassified files. Use the same discovery for `bun test:p0` through `bun test:p3`; workflows contain no filename lists and never drop work because time elapsed.
3. Run added/edited tests in required PR jobs at their declared priority. Shared test helpers/configuration select the owning suite. A changed runner entry selects its adjacent P0 process contract when present, otherwise its suite. Avoid duplicating baseline P0 work.
4. Preserve native/packaged platform matrices. Run edited benchmarks once in their registered suite to retain cold-start order and workload. Finish independent edited-test files after failure and retain evidence.
5. Queue P1 covers API, database, Bun, and service source contracts plus dashboard startup. Broad browser/native P1 and all required P2/P3 run in nightly and stable validation. Critical component interactions remain P1; comprehensive permutations remain P2. Moving a stage changes no priority, workload, or allowance.
6. Keep API tests in fresh per-file processes under [ADR 0018](0018-temporary-api-test-process-isolation.md), at most two active files, with the existing 30-second test limit. Timing metadata may balance whole files across shards.
7. `ci:full` dispatches trusted base-branch workflow code against the exact internal PR merge SHA and reports `production_ci_passed`. Forks require the maintainer diagnostic path. This functional profile replaces neither `ci_passed` nor a release/P3 certificate.

## Failure policy

1. Only P1 fails fast. P0/P2/P3 finish selected independent work and stream failures. Setup failure never makes blocked consumers successful.
2. After execution jobs finish, `validation_results` checks the selected graph through GitHub's API. Reject missing, duplicate, skipped, cancelled, or failed required outcomes. Preserve immediate P1 failure visibility while collecting remaining diagnostics.
3. Keep the `ci_passed` context, its five-minute allowance, the aggregation's 40-minute allowance, and ALLGREEN merge-queue policy.
4. Use peer-result polling and local termination for cross-job P1 stopping, not workflow cancellation; see [temporary cooperative cancellation](0108-temporary-cooperative-p1-cancellation.md). Mixed-priority production matrices disable matrix-wide fail-fast.
5. Quarantine stays explicit and visible. Never automatically quarantine, retry to green, or make a failure optional. Setup and incomplete quarantine execution still block.

## Inputs and publication

1. Record source commit/tree, policy/build inputs, toolchain, selected jobs/matrix rows, case identities, executed/skipped outcomes, missing reports, cancellations, and phase timings. A bailed report leaves unexecuted cases unknown.
2. Cache build archives by source/dependency inputs, lockfile, compiler/build helpers, runtime versions, OS/architecture, and relevant environment. Expose committed generated outputs for stale-file checks. Never reuse a passing test as proof for another tree.
3. Promote queue archives only after main verifies their exact tree and inputs. Container caches save after builds; misses build normally. Cache hits never remove fresh behavior checks.
4. Distinguish the immutable candidate's source SHA from its generated version commit. Verify checkout, build identity, producer run/attempt, artifact IDs/digests, policy, and toolchain.
5. Stable publication consumes a complete matching release certificate and rejects changed inputs. A source-built nightly Windows diagnostic cannot certify a stable published app.
6. Nightly publication requires basic artifact integrity and all-or-nothing publication. Deep P2/P3 diagnostics run independently; stable publication waits for complete functional and performance evidence.

## Qualification and consequences

- Regressions outside queue P0/P1-source/smoke coverage can first appear after merge. Stable releases still require the complete candidate certificate.
- Local runner/gate, component, and relay checks do not prove every platform ran or that wall-time targets were achieved.
- Hosted qualification covers representative source, SDK/UI, extension, tooling, and native changes; cold/warm paths; early P1 rejection with slower P0; missing rows; stale candidates/artifacts; P2/P3 failure collection; and first-attempt phase evidence.
- Verify live check identity and queue behavior, including retained P0 evidence after early P1 rejection. A passing rerun does not prove reliability.
- On failed qualification, restore the last qualified gate, keep its context and ALLGREEN policy, discard stale queued candidates, and verify fresh ones. Never disable the gate or publish incomplete evidence.
- Commands and qualification details live in [CI stages](../guides/development/0015-ci-stages.md).
