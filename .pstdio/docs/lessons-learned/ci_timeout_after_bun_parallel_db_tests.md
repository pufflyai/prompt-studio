# CI timeouts after a green Bun test summary can be runner hangs

> **Follow-up:** the CI job timeout this entry set out to fix turned out to be caused elsewhere — in the hung runs `pstdio-db:test` had completed and `pstdio-api:test` was the task that never finished, stuck in a recursive `fs.watch` crawl. See [linux_recursive_fs_watch_crawls_node_modules.md](linux_recursive_fs_watch_crawls_node_modules.md). The wrapper cleanup below still stands on its own.

## What went wrong

GitHub Actions "Test and Build" hit the 15-minute job timeout even though the `pstdio-db:test` log had already printed a successful Bun test summary. That made the failure easy to misread as a later target, a general memory problem, or something that needed more timeout budget.

The important signal was that the process did not exit after the green summary. CI cancellation still found lingering shell/Bun worker processes.

## Why

`pstdio-db` had moved through a series of custom test-runner changes around `bun test --parallel=1 --silent`. The wrapper eventually learned to detect a successful summary and terminate the child process, but that was treating the symptom: Bun had already reported success while the command path still had worker/process lifetime issues.

The final fix was simpler: stop using the custom wrapper and stop forcing Bun's worker path for this package. `pstdio-db` now runs tests directly with:

```sh
bun test --silent
```

That lets Bun own the process lifetime and avoids a repo-local wrapper that can disagree with the real command exit state.

## How it was solved

- Removed `packages/pstdio-db/scripts/run-tests.ts`.
- Removed wrapper-specific tests that only covered the deleted implementation detail.
- Changed `packages/pstdio-db`'s `test` script back to direct `bun test --silent`.
- Verified the package and full validation path before trusting the CI result.

## Key takeaways

- A printed Bun test summary is not the same thing as the test command exiting.
- When CI times out after a green-looking summary, inspect process lifetime and the exact still-running target before assuming memory pressure.
- Prefer deleting a fragile test wrapper over adding summary parsing or force-kill logic.
- Reproduce suspicious CI behavior in a clean Ubuntu container; macOS local runs can hide worker, process, and filesystem differences.
