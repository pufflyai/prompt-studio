# Run relevant PR checks before merging

Proposed: 2026-10-20

Status: Accepted. Supersedes the PR and merge-queue stage decisions in [ADR 0072](0072-gate-merges-on-builds-and-publish-releases-all-or-nothing.md). Its release decisions still apply.

## Context

The build-only queue catches build failures but misses test regressions. Running the full suite on every PR would restore long feedback times. PRs need broad, relevant checks with a five-minute target. The queue must run at least the checks selected for every PR in its group.

## Decision

- Use the same selection policy for PRs and merge groups. Select affected packages and their transitive consumers from workspace manifests and explicit Nx dependencies. Include dependencies on released workspace packages, since their consumers still need compatibility checks.
- Compare a PR's synthetic merge commit with its target parent. Compare a merge group with the payload's base SHA. Include each group member's original file list and labels, so opposing changes cannot cancel selected checks and a companion PR's `ci:full` label is preserved.
- Run type checking and lint separately from unit and conformance tests. Keep the existing Linux API and database shards.
- Select short real-app browser regressions for sessions, retained editor state, and extension lifecycle and webviews. Pair short specs in parallel jobs to share build setup, while starting a separate runtime for each spec. These checks do not start Storybook.
- Select Windows filesystem, process, and desktop platform contracts for their production inputs. Share one Windows runner's cold setup across the selected short groups. Keep full Windows database tests, desktop packaging, packaged toolchain verification, benchmarks, and the full browser suite in the full stage.
- Split the full Windows API suite into eight shards and the database suite into four. Build only each shard's package and dependencies. Retain the existing per-test limits and two-worker API scheduler, including its isolated process-discovery tests. Run all shards even if one fails; the required gate waits for their combined result.
- Preserve `ci:full` as the explicit full-stage override, including in the merge queue. Main pushes and manual runs still use the full stage. The full suites already include the targeted browser and Windows checks, so those targeted jobs need not run twice.
- Reuse Bun dependency downloads and portable Nx task archives. Each job starts a loopback server implementing Nx's supported HTTP cache API, backed by a GitHub Actions cache directory. This lets Nx import archives without copying its machine-bound local database. Partition caches by platform, architecture, toolchain and workspace profile. Hash shared compiler settings, lockfile, build helpers and build environment inputs. Regenerate Chakra's installed theme declarations outside the build cache.
- Declare the generated, committed webview runtime as the extension build's cache output, so a cache hit still exposes stale committed output to the static check. Keep the short compiled CLI build uncached: it also generates the embed manifest and vendors PGlite assets outside its package output directory.
- Have the scope name every required job. `ci_passed` rejects failed or cancelled jobs and any selected job that skips or has no result.

## Consequences

PR feedback comes from parallel relevant checks. Five minutes is the normal scoped-run target, not a reason to reduce assertions, raise limits or skip failing checks. `ci:full` deliberately retains the longer full stage. The existing weekly failure report remains available.

The queue retains unsigned builds of every client and adds the same selected checks as its PRs. A combined change can still fail even when its individual PRs passed. Full test coverage on main still catches scenarios outside the selected regression families. Cache misses still build the required dependencies.
