# Temporary CI limits for heavy-setup tests

Proposed: 2026-09-27

Status: Accepted as a temporary workaround. The user approved the original values on 2026-09-27 and later explicitly requested a 15 s default for Windows tests after another database migration test exceeded 5 s.

On 2026-10-20, the user approved a 30 s allowance for only the Windows environment-identity restart test.

## Intended design

Unit tests finish well inside Bun's 5 s default limit on every CI runner. A test that needs longer shows that the test, or the code it exercises, does too much work.

## External limitation

These tests do expensive real work on purpose, and CI runner speed varies from run to run:

- The `pstdio-db` `createDb` tests in `packages/pstdio-db/src/db/connection.pglite.p1.test.ts` create real on-disk PGlite databases, which write about a thousand PostgreSQL files. On Windows runners this takes 2–4 s, and has spiked to 11 s ([run 36301344835](https://github.com/pufflyai/prompt-studio/actions/runs/36301344835)). Two runs of the same commit differed by about a third on every step. A Defender-scanning experiment (#777) did not change the timings, so the variance comes from the hosted runner.
- The desktop packaged-fixture timeout test in `clients/desktop/src/testing/packaged-fixture.p0.test.ts` starts two full Node and Playwright processes, the runner and a worker. Playwright startup is over 90% of its time. On Linux CI, which runs three test suites in parallel on four CPUs, it takes a median of 4.0 s and up to 5.0 s over 55 runs, and it failed once at 5.004 s. Under CPU load it failed 14 of 14 times with the default limit and finished in 5.1–8.9 s with more time. There is no hang: the kill and the child's exit took at most 222 ms.
- The packaged-image disk tests in `packages/pstdio-db/src/db/open-pglite.p1.test.ts` perform the same real database file creation, copying, and removal. Windows [run 36328139117](https://github.com/pufflyai/prompt-studio/actions/runs/36328139117) reported a lifecycle-hook timeout and 7.67 s for its first test, versus 2.22 s in [run 36328016655](https://github.com/pufflyai/prompt-studio/actions/runs/36328016655). The log alone cannot identify the slow phase: Bun 1.4.2 can [mislabel a beforeAll timeout as beforeEach/afterEach](https://github.com/oven-sh/bun/issues/42361). Local synchronous and asynchronous removal took the same time, so changing the cleanup API would not establish a fix.
- The managed Git worktree migration test in `packages/pstdio-db/src/db/legacy-worktree.test.ts` (removed in 0.46 with the upgrade code) also created and upgraded an on-disk database. The user reported 11.763 s against the 5 s default, about 2.35 times the limit. The same test completed locally on macOS in 1.963 s. Per-test exceptions had left this test exposed to the same Windows runner variance.
- The environment-identity restart test creates, migrates, closes, reopens, verifies, and removes two independent disk databases. Windows [run 39414460419](https://github.com/pufflyai/prompt-studio/actions/runs/39414460419) finished its assertions in 12.7 s, then spent 6.7 s removing both folders: 19.4 s in total against the 15 s default. The preceding Windows [run 39411821594](https://github.com/pufflyai/prompt-studio/actions/runs/39411821594) completed the same test in 4.7 s. Linux CI completed it in 3.0 s. After the local environment reconnected, source database bootstrapping exceeded the 5 s local default. Preparing an empty PostgreSQL image, as packaged runtimes do, brought three local runs to 2.3–2.8 s. Each disk database still runs its application migrations, identity creation, restart, persistence checks, and cleanup. The test does not measure cold-start performance.

## Why a clean solution is not available now

These tests exercise behavior that needs this work: a real on-disk database, and Playwright's own fixture teardown after a test timeout. Replacing them with in-memory or mocked versions would stop testing the behavior. Cheaper Playwright startup options gained 10–15% at most, which is within the noise.

## Temporary workaround

- Windows CI passes `--timeout=15000` to the focused dependency tests, the desktop command setup tests, and the package test scripts run through Lerna. Bun tests and lifecycle hooks inherit this default, including the managed Git worktree migration test. Explicit test limits and custom runners retain their own limits. Other CI platforms retain their existing defaults.
- The `pstdio-wt` suite runs separately with its existing 30 s command-line limit so the forwarded argument does not shorten it. The API test runner also retains its existing 30 s limit.
- The database suites retain their per-test and hook limits for local Windows runs. Cleanup still waits for database closure and propagates removal errors.
- Only the environment-identity restart test gets the approved 30 s allowance on Windows, including both complete database lifecycles and folder removal. Other platforms retain their default. This is an execution allowance, not a performance budget.
- The packaged-fixture timeout test gets a 10 s limit on all platforms: 2.5 times the Linux median, and 2 times the slowest CI run.

Trade-offs: a real slowdown in a Windows test has to grow further before CI catches it. The Windows CI default also applies to tests without heavy setup. Job limits and Playwright defaults remain unchanged.

## Isolation

The Windows CI default is set in the Windows job's test commands, with the Lerna command's comment pointing here. New test commands in that job must also pass the same default. Local database tests and the packaged-fixture timeout test retain their explicit limits. Runtime code does not use these limits.

Bun's `setDefaultTimeout` applies to the current file, so setting it in a shared preload does not cover later files and their hooks. A local two-file probe on Bun 1.4.2 allowed the first file's 5.2 s hook and test to finish, but the second file's test still failed at 5 s. The command-line limit covers the whole run without changing package scripts or test setup.

## Removal

Remove the Windows default when the affected disk and migration suites finish well inside 5 s across 20 Windows CI runs, or when those tests no longer need the expensive setup. Remove the packaged-fixture limit when its median is under 2.5 s over 20 runs, or its expensive setup is removed. Check durations in the CI logs before removing either limit.

Remove the environment-identity exception when its full disk lifecycle finishes well inside 15 s across 20 Windows CI runs, or when equivalent coverage no longer needs two disk databases.
