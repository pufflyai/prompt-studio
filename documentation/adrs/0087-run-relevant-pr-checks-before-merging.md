# Run relevant PR checks before merging

Proposed: 2026-10-20

Status: Accepted. Supersedes the PR and merge-queue stage decisions in [ADR 0072](0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md). Its release decisions still apply. Changed on 2026-10-24: merge groups run the full stage; see [Full stage in the merge queue](#full-stage-in-the-merge-queue).

## Context

The build-only queue catches build failures but misses test regressions. Running the full suite on every PR would restore long feedback times. PRs need broad, relevant checks with a five-minute target. The queue must run at least the checks selected for every PR in its group.

## Decision

- Select PR checks from affected packages and their transitive consumers, using workspace manifests and explicit Nx dependencies. Include dependencies on released workspace packages, since their consumers still need compatibility checks.
- Compare a PR's synthetic merge commit with its target parent.
- Run type checking and lint separately from unit and conformance tests. Keep the existing Linux API and database shards.
- Select short real-app browser regressions for sessions, retained editor state, and extension lifecycle and webviews. Pair short specs in parallel jobs to share build setup, while starting a separate runtime for each spec. These checks do not start Storybook.
- Select Windows filesystem, process, and desktop platform contracts for their production inputs. Share one Windows runner's cold setup across the selected short groups. Keep full Windows database tests, desktop packaging, packaged toolchain verification, benchmarks, and the full browser suite in the full stage.
- Split the full Windows API suite into eight shards and the database suite into four. Build only each shard's package and dependencies. Retain the existing per-test limits and two-worker API scheduler, including its isolated process-discovery tests. Run all shards even if one fails; the required gate waits for their combined result.
- Run the remaining full Windows checks in six parallel rows: lint, native and packaged contracts, and four unit-test shards. Forward Bun's file-sharding argument to every package test script. Shard Git worktree tests separately with their existing 30-second limit. Each row builds the monorepo through the shared cache; all rows must succeed.
- Preserve `ci:full` as the explicit full-stage override on PRs. Merge groups, main pushes and manual runs use the full stage. The full suites already include the targeted browser and Windows checks, so those targeted jobs need not run twice.
- Reuse Bun dependency downloads and portable Nx task archives. Each job starts a loopback server implementing Nx's supported HTTP cache API, backed by a GitHub Actions cache directory. This lets Nx import archives without copying its machine-bound local database. Partition caches by platform, architecture, toolchain and workspace profile. Hash shared compiler settings, lockfile, build helpers and build environment inputs. Regenerate Chakra's installed theme declarations outside the build cache.
- Declare the generated, committed webview runtime as the extension build's cache output, so a cache hit still exposes stale committed output to the static check. Keep the short compiled CLI build uncached: it also generates the embed manifest and vendors PGlite assets outside its package output directory.
- Have the scope name every required job. `ci_passed` rejects failed or cancelled jobs and any selected job that skips or has no result.

## Consequences

PR feedback comes from parallel relevant checks. Five minutes is the normal scoped-run target, not a reason to reduce assertions, raise limits or skip failing checks. `ci:full` deliberately retains the longer full stage. The existing weekly failure report remains available.

The queue runs the full stage, including unsigned builds of every client. A combined change can still fail even when its individual PRs passed; the queue removes that PR instead of merging it. Cache misses still build the required dependencies.

## Full stage in the merge queue

Changed on 2026-10-24. With the selected checks in the queue, the Windows, browser E2E, desktop and packaged suites ran only after merge. From 2026-10-12 to 2026-10-23, 51 of 200 `main` runs passed. About 85% of failed main jobs failed in streaks of consecutive runs, up to 28 runs long, and every regression traced that week had passed its PR and queue checks. Merge groups now run the full stage, so `main` receives only commits that passed every check `main` runs.

A queue run takes about 20 minutes instead of about 7. It uses about as many runner minutes as the `main` run that follows it. Flaky full-stage checks now remove pull requests from the queue, so they must be fixed or quarantined rather than re-run. The Merge queue removals workflow labels removed pull requests, and the Prompt Studio Dev extension starts a repair session for each one.
