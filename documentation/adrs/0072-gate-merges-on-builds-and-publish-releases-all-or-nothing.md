# Gate merges on builds and publish releases all or nothing

Proposed: 2026-10-12

Status: Accepted. The PR and merge-queue stage decisions are superseded by [ADR 0085](0085-run-relevant-pr-checks-before-merging.md). The release decisions still apply.

## Context

CI has three jobs: give pull requests fast feedback, keep `main` buildable, and ship releases. In October 2026 it did none of them well (PS-658).

- The median pull request run took 12.5 minutes, because nearly every pull request ran Windows and e2e jobs.
- The merge queue had been removed on 2026-10-02 because it ran the full test suite and flaky tests rejected good pull requests. After that, nothing tested the merged result before it reached `main`. Merge skew broke `main` 5 times in a row, and checks that ran only at release time went stale until release day.
- The release published npm packages and pushed the tag before it built the desktop apps. A desktop failure left a version on npm with no desktop release. The next run saw the version on npm and skipped the release, so recovery needed manual dispatches. 0.41.0 has no tag or GitHub release for this reason.
- A separate release rehearsal ran only when the version PR's CI triggered it. That trigger did not fire for the approved re-run of a bot-pushed PR, so 0.43.0 merged without a rehearsal.

## Decision

Each CI stage has one job.

1. **Pull requests** run fast, scoped checks on Linux. A `ci:full` label runs everything on demand.
2. **The merge queue** runs only deterministic work: whole-repository static checks and an unsigned build of every client on every platform. It never runs tests, so a flaky test cannot reject a pull request.
3. **Pushes to `main`** run the full test suite. A failure blocks nothing and marks the commit that caused it.
4. **Releases** build and verify every artifact from one commit before they publish anything. The publish job publishes npm packages first and the GitHub release last, so a published GitHub release is the only done marker. Every publish step skips work that is already done. A failed release resumes with a re-run or with the next push to `main`.
5. **Nightlies** run the same release jobs, so every night rehearses the stable path. The separate rehearsal and its pull request gate are removed.

Release tags follow two rules:

- The tag of an unpublished release moves to the newest commit on `main`, because nothing has consumed it yet. A re-run of an older run never moves it back.
- Once npm has part of a version, including a CLI platform package, the tag stays, and the release finishes from the commit that started publishing. npm and the desktop apps never come from different commits. Each attempt dry-runs `npm publish` before the first package is published, so a packing error cannot start a release that can never finish.

## Consequences

- Pull request feedback is fast, and every commit on `main` builds every client.
- A test regression can merge. It appears on the `main` commit that caused it.
- Merging waits for the queue's builds, for up to five pull requests at a time.
- npm receives a new version about 30 to 40 minutes later than before, because publishing waits for the desktop builds and the Windows update check.
- A run that resumes from an older commit uses the newest workflow files with that commit's scripts. The old `validation_ref` input that mixed check revisions is gone, so a workflow change that the older scripts cannot run needs the next version instead.
- A nondeterministic build or static check now blocks merging and must be fixed at once.
- The release pipeline can run end to end only from `main`, because npm trusted publishing and Windows signing trust `main` and release tags. Nightlies are its regular test.

## Alternatives

- **Require pull requests to be up to date with `main`.** Catches merge skew, but forces a rebase and full run for every merge.
- **Run tests in the merge queue.** Gates regressions, but flaky tests reject good pull requests, which is why the queue was removed.
- **Keep the rehearsal and fix its trigger.** The release itself could still stop halfway, and the rehearsal duplicates the release pipeline.
