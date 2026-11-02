# Temporary cooperative P1 cancellation

Proposed: 2026-10-25

Status: Accepted as a temporary workaround for the failure policy in [ADR 0129](0129-prioritize-merge-checks-and-certify-release-candidates.md).

## Intended behavior

The first P1 failure should stop queued and active P1 work promptly across jobs, while P0, P2, and P3 keep collecting their diagnostics. Individual P1 failures remain visible immediately. The aggregate required result waits for all execution jobs; see the runner-capacity qualification below. Successful validation still requires every selected result.

## External limitation

As reviewed on 2026-10-25, GitHub documents cancellation at workflow-run scope. Its documented workflow-job API exposes job and log reads, but no operation that cancels an arbitrary selected set of peer jobs. This is an inference from the published endpoint inventories, not a claim about an undocumented API. See the primary [workflow-run API](https://docs.github.com/en/rest/actions/workflow-runs#cancel-a-workflow-run) and [workflow-job API](https://docs.github.com/en/rest/actions/workflow-jobs).

GitHub's native matrix fail-fast applies to the whole matrix. It cannot selectively stop only P1 rows in a matrix that also contains P2 Windows work. The [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstrategyfail-fast) documents that scope. Run cancellation can also affect unrelated jobs and their cleanup; see [workflow cancellation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation).

A clean server-side cancellation request for only the selected P1 peers is therefore unavailable through the documented interface. Cancelling the entire workflow would break the required failure policy.

## Temporary workaround

Keep native fail-fast on matrices containing only P1 work. Disable it on mixed-priority production matrices. P1 command supervisors read the current run attempt's job outcomes before starting work and every 30 seconds while work runs. They use the selected plan and observed job names to ignore P0, P2, P3, unselected jobs, and Windows rows. A P1 failure stops only that supervisor's remaining P1 commands and active children.

Each observer retains its own HTTP ETags and uses authenticated conditional reads. GitHub states that unchanged `304` responses do not count against the primary API limit; see [REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests). The shared client reports GitHub's refusal message and quota headers. It stops network polling until the server's retry or reset time when rate limited. It never uses a cached body after an API refusal or treats missing results as successful. This reduces the request load of parallel supervisors while the required monitor keeps its five-second result checks.

The implementation is isolated in `scripts/ci/p1-fail-fast.ts` and `scripts/ci/run-ci-checks.ts`. It uses Actions read permission. It never calls workflow cancel or force-cancel. Bootstrap steps that install Bun run before the Bun supervisor can operate.

A separate read-only `validation_results` job requires complete selected results after execution jobs finish. P0/P2/P3 collection and final production certification remain separate from peer stopping.

### Runner-capacity qualification

On 2026-10-31, merge-queue run 41198313164 exhausted the existing 40-minute result-reader allowance while execution jobs still waited for hosted runners. No selected test had failed. Starting a polling result reader alongside execution both consumed scarce runner capacity and charged runner queue time to a job execution allowance.

GitHub job dependencies now hold the result reader until execution finishes, without occupying a runner. This restores the distinction between queue waiting and execution. The aggregate required failure can arrive later than an individual P1 failure because P0/P2/P3 diagnostics still finish. P1 supervisors retain early cooperative stopping. No workload or time limit changes.

## Limitations

Stopping is cooperative, so queued jobs may still obtain runners and setup actions can finish before the supervisor starts. Result propagation, the polling interval, and API latency add delay. If peer observation is unavailable, the supervisor warns and continues local validation; it cannot manufacture a successful required result. The selected-result monitor remains blocking if it cannot obtain complete evidence.

Local child-runner tests prove process stopping and collection behavior. They do not prove how GitHub's merge queue treats surviving P0 jobs after early rejection. Hosted qualification must retain those outcomes or keep the rollout unqualified; it must not assume that local signal tests prove server behavior.

## Removal

Review this workaround when GitHub publishes selective job cancellation, priority-scoped matrix cancellation, or another supported mechanism that can stop P1 without affecting other tiers. Replace the supervisor polling only after a hosted test proves early P1 stopping, preserved P0/P2/P3 execution and evidence, correct cleanup, and rejection of stale attempts.

Then remove peer polling, its flags and tests, and the temporary documentation together. Retain the result gate, priority policy, and fresh test execution. Do not remove the workaround by reverting to workflow-wide cancellation.
