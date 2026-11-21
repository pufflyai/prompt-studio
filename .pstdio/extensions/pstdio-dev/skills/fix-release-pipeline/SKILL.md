---
name: fix-release-pipeline
description: Get Prompt Studio's release pipeline (nightly, verify or stable Release Packages runs) green in one pass. Find every blocker at once, run the release-only gates locally, triage by root cause, fix in parallel and verify before dispatching the next run. Use when a nightly fails to publish, a verify or stable run is red, or the user asks to make the release pipeline green or stable.
metadata:
  version: 0.0.1
---

# Fix the release pipeline in one pass

A Release Packages run takes about an hour. Fixing blockers one run at a time multiplies that. The goal is to know **every** blocker within the first hour, fix them all in parallel, and dispatch the next run only after the release-only gates pass locally.

Loading this skill authorizes no stable publication. Dispatching nightly or `verify` runs is fine when the user asked for a green pipeline or a nightly.

## 1. Start everything at once (first 10 minutes)

Do all of these in parallel. Don't wait for one before starting the next.

1. **Dispatch a release run** from `main`, even if you expect test failures. It is the only place release tooling, signing, upgrade and publication run.
   - Nightly: `gh workflow run release-packages.yml --ref main -f channel=nightly`
   - Verify the version candidate: `-f channel=verify -f source_sha=<head of changeset-release/main>`
2. **Run the release-only gates locally** from a Prompt Studio workspace on `origin/main` (`pst workspaces create --provider pstdio.worktree --params '{"base":"origin/main"}'`):
   - Versioning: `bunx changeset status`. A changeset that names a package in `.changeset/config.json`'s `ignore` list alongside other packages fails `plan` ("Mixed changesets…").
   - Upgrade paths. Build a candidate with `PSTDIO_EXTENSION_RELEASE_REF=$(git rev-parse HEAD) bun run build -- --scope pstdio --include-dependencies`, then run `bun --no-env-file packages/e2e/src/packaged/project-upgrade.ts --candidate dist/pstdio --candidate-ref <sha> --from <tag>` for **both** the latest published nightly and the latest stable tag. `publish_nightly` requires the nightly-to-nightly upgrade to pass.
   - Lint at error level, which CI's truncated output can hide: `bunx biome check --diagnostic-level=error .`
3. **Read the last completed release run** with `gh run view <id> --json jobs`, so you know every failing job, not only the first.
   - Read the full output of `validation_results` too. It lists problems that no job is marked failed for, such as `Browser selection never reported: <file>`, which happens when every test in a spec is quarantined.
   - Treat `cancelled` and `timed_out` jobs as failures. A cancelled shard hides whatever tests it never reached.
   - Check each failing test's history across the last 5–10 runs (grep the job logs for its `✓`/`✘` line). A test that fails once in three runs is a flake to fix now, not something to rediscover in later runs. Playwright retries are 0 here, so a first-attempt `✘` is a real failure even if the job ended green or cancelled.
4. **Open or update one coordination issue on GitHub.** List each failure group, its owner or PR, and the maintainer's decisions. Comment on related PRs so other agents can claim work. Check open PRs (`gh pr list`) before starting anything, because another agent may already own a group.

## 2. Triage every failure by root cause

Collect all failing tests and jobs from the run and the local gates into one list, then group them:

| Kind | Typical signal | Usual fix |
| --- | --- | --- |
| Release tooling | `plan` fails, a changeset error, `startup_failure` | Fix the changeset or workflow config |
| Upgrade path | `nightly_upgrade` / `project-upgrade` fails | Product fix (retired extension, adoption, migration) or the check's wait |
| Product regression | Many journeys fail after one merge | `git log <last green>..<red>` and bisect the culprit PR |
| Spec drift | A journey waits for retired UI after an intentional product change | Update the spec to the new user path and keep its assertions |
| Platform-only | Windows `EBUSY`/`EPERM`, macOS timing | Native fix, verified with the `ci:windows` diagnostic |
| Time limit | A job is cancelled at its `timeout-minutes` | Find the slow phase and split the work. Never raise a limit without explicit approval |
| Performance | P3 or B1–B8 limit misses | Since the release split, performance no longer gates certification. Check the current policy before treating it as a blocker |
| Flake | Passes and fails on the same code | Prove it with several CI samples, then fix, or quarantine with evidence |
| Job time limit, no failing test | A shard is `cancelled` near its `timeout-minutes` while every finished test passed | Compare passing durations with the limit. Add shards in `scripts/ci/test-selection.ts` instead of raising the limit |
| Artifact infrastructure | `None of the provided artifact IDs were found`, `CreateArtifact` timeouts | Downloads go through `.github/actions/download-artifact-by-id`, because download-artifact v4 lists only 100 artifacts. Diagnostic uploads must not fail a passed check |
| Lost webview click | A click into an extension webview has no effect right after a popover opens | Wait for the host to paint first (trial-click the host iframe). See lessons-learned 0033 |

Failures hide behind each other. A cancelled shard hides the tests it never ran, and one red job can mask a broken summary check. After fixing a batch, read everything the next run reports again, including the summary jobs.

Frozen benchmark sources are the workflows and helpers hashed by `packages/benchmarks/catalog.lock.json`, for example `production-desktop.yml` and `packages/e2e/src/packaged/packaged-serve-helpers.ts`. They change only in a benchmark-labeled PR with a recomputed digest and the maintainer's direct approval. Run `bun run verify:benchmarks` before pushing any CI or e2e helper change.

A failure that appears only after a merge is a regression in that merge. Find the merge before patching specs.

## 3. Fix in parallel, one batch

- Give each root cause to a separate agent or PR. Ask the user to raise the concurrent-subagent limit for release work if it is 1.
- Ask the user **up front** for every product decision the failures need (intended behaviour, budgets, timeouts, overrides), in one question set rather than one per run.
- Keep fixes small and owned: one root cause per PR, a regression test that fails before the fix, and a changeset only when a shipped package changes.
- Have each PR reviewed independently, for example with `/code-review medium <pr>`, before queueing. Reviews catch fixes that weaken assertions or block unrelated upgrades.
- Never raise a timeout or budget, add retries or skip platforms without the user's explicit approval of that exact value.
- When time is short and the user asks for it, quarantine cases that take longer to fix. Add them to `scripts/ci/test-quarantine.json` with owner, evidence and removal criteria, scoped to the failing platforms. Verify with `CI_PROFILE=production RELEASE_CHANNEL=nightly bun scripts/ci/pull-request-ci-scope.ts` that stable runs list them as `quarantineIds`.
- If the user explicitly overrides a release gate, keep the check running and reporting, and mark the gate `TEMPORARY` with a comment saying to restore it before the stable release.

## 4. Land and dispatch

1. Read the current PR labels immediately before any merge or queue action. If `benchmark` is present, leave the PR for human review and merge: never enqueue it, merge it, enable auto-merge, or remove the label to bypass this rule, even with green CI and resolved review (004.1.11). For other PRs, queue only when CI is green and review is resolved, using `enqueuePullRequest`. Queue the eligible PR that unblocks publication first.
2. Two PRs that each need the other's spec fix: merge one branch into the other and land them together.
3. A branch in the merge queue can't be pushed. Put follow-ups on a new branch.
4. A background hand-off loop must re-read the current labels immediately before each queue attempt. If `benchmark` is present, stop automatic queueing for that PR and leave it to a human; do not reuse an earlier eligibility result. For other PRs, queue only when the current head checks are green and review is resolved, then dispatch the next run after it merges.
5. Dispatch the next run only after the local release gates pass on the merged code.

## 5. Prove stability

- "Green" means `publish_nightly` (or `certify`) succeeds **and** the production validation jobs pass.
- "Stable" means at least two or three consecutive complete runs with no new failures and no flakes. Keep one run going while fixes land.
- Record follow-ups for anything quarantined, overridden or left as a known limitation on the coordination issue before calling the pipeline ready.

## Useful commands

```sh
# Failed jobs of a run, in order
gh run view <run> --json jobs --jq '.jobs[]|select(.conclusion=="failure")|"\(.completedAt) \(.name)"' | sort

# A job's log without terminal escapes
gh api --allow-escape-sequences repos/pufflyai/prompt-studio/actions/jobs/<job>/logs | sed 's/\x1b\[[0-9;]*m//g'

# Which step of a job failed
gh run view <run> --json jobs --jq '.jobs[]|select(.name=="plan")|.steps[]|select(.conclusion=="failure")|.name'

# Required checks of a PR head, ignoring optional reviewers
gh api "repos/pufflyai/prompt-studio/commits/<sha>/check-runs?per_page=100" \
  --jq '[.check_runs[]|select(.conclusion!="skipped" and (.name|test("copilot")|not))|(.conclusion // "pending")]'

# Inspect current labels first; never run the queue mutation for a benchmark PR.
gh pr view <n> --json labels --jq '.labels[].name'

# Queue only an eligible non-benchmark PR after CI and review pass.
gh api graphql -f query='mutation($id:ID!){enqueuePullRequest(input:{pullRequestId:$id}){mergeQueueEntry{position}}}' \
  -f id="$(gh pr view <n> --json id -q .id)"
```
