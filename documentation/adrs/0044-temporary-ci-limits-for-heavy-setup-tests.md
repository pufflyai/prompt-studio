# Temporary CI limits for heavy-setup tests

Proposed: 2026-09-27

Status: Accepted as a temporary workaround. The user approved the original values on 2026-09-27 and later explicitly requested a 15 s default for Windows tests after another database migration test exceeded 5 s.

The 2026-11-14 cleanup removed the packaged-fixture meta test and failing environment-identity restart case. Their former individual allowances no longer apply.

## Intended design

Unit tests finish well inside Bun's 5 s default limit on every CI runner. A test that needs longer shows that the test, or the code it exercises, does too much work.

## External limitation

These tests do expensive real work on purpose, and CI runner speed varies from run to run:

- The `pstdio-db` `createDb` tests in `packages/pstdio-db/src/db/connection.pglite.p1.test.ts` create real on-disk PGlite databases, which write about a thousand PostgreSQL files. On Windows runners this takes 2–4 s, and has spiked to 11 s ([run 36301344835](https://github.com/pufflyai/prompt-studio/actions/runs/36301344835)). Two runs of the same commit differed by about a third on every step. A Defender-scanning experiment (#777) did not change the timings, so the variance comes from the hosted runner.
- The packaged-image disk tests in `packages/pstdio-db/src/db/open-pglite.p1.test.ts` perform the same real database file creation, copying, and removal. Windows [run 36328139117](https://github.com/pufflyai/prompt-studio/actions/runs/36328139117) reported a lifecycle-hook timeout and 7.67 s for its first test, versus 2.22 s in [run 36328016655](https://github.com/pufflyai/prompt-studio/actions/runs/36328016655). The log alone cannot identify the slow phase: Bun 1.4.2 can [mislabel a beforeAll timeout as beforeEach/afterEach](https://github.com/oven-sh/bun/issues/42361). Local synchronous and asynchronous removal took the same time, so changing the cleanup API would not establish a fix.
- The managed Git worktree migration test in `packages/pstdio-db/src/db/legacy-worktree.test.ts` (removed in 0.46 with the upgrade code) also created and upgraded an on-disk database. The user reported 11.763 s against the 5 s default, about 2.35 times the limit. The same test completed locally on macOS in 1.963 s. Per-test exceptions had left this test exposed to the same Windows runner variance.

## Why a clean solution is not available now

These product tests exercise real on-disk database behavior. Replacing them with in-memory or mocked versions would stop testing that behavior.

## Temporary workaround

- Windows CI passes `--timeout=15000` to the focused dependency tests, the desktop command setup tests, and the package test scripts run through Lerna. Bun tests and lifecycle hooks inherit this default, including the managed Git worktree migration test. Explicit test limits and custom runners retain their own limits. Other CI platforms retain their existing defaults.
- The `pstdio-wt` suite runs separately with its existing 30 s command-line limit so the forwarded argument does not shorten it. The API test runner also retains its existing 30 s limit.
- The database suites retain their per-test and hook limits for local Windows runs. Cleanup still waits for database closure and propagates removal errors.

Trade-offs: a real slowdown in a Windows test has to grow further before CI catches it. The Windows CI default also applies to tests without heavy setup. Job limits and Playwright defaults remain unchanged.

## Isolation

The Windows CI default is set in the Windows job's test commands, with the Lerna command's comment pointing here. New test commands in that job must also pass the same default. Local database tests retain their explicit limits. Runtime code does not use these limits.

Bun's `setDefaultTimeout` applies to the current file, so setting it in a shared preload does not cover later files and their hooks. A local two-file probe on Bun 1.4.2 allowed the first file's 5.2 s hook and test to finish, but the second file's test still failed at 5 s. The command-line limit covers the whole run without changing package scripts or test setup.

## Removal

Remove the Windows default when the affected disk and migration suites finish well inside 5 s across 20 Windows CI runs, or when those tests no longer need the expensive setup. Check durations in the CI logs before removing the limit.
