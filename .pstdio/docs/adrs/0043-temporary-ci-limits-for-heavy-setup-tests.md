# Temporary CI limits for heavy-setup tests

Proposed: 2026-09-27

## Status

Accepted as a temporary workaround. The user approved each value on 2026-09-27.

## Intended design

Unit tests finish well inside Bun's 5 s default limit on every CI runner. A test that needs longer shows that the test, or the code it exercises, does too much work.

## External limitation

Two tests do expensive real work on purpose, and CI runner speed varies from run to run:

- The `pstdio-db` `createDb` tests in `packages/pstdio-db/src/db/connection.pglite.test.ts` create real on-disk PGlite databases, which write about a thousand PostgreSQL files. On Windows runners this takes 2–4 s, and has spiked to 11 s ([run 36301344835](https://github.com/pufflyai/prompt-studio/actions/runs/36301344835)). Two runs of the same commit differed by about a third on every step. A Defender-scanning experiment (#777) did not change the timings, so the variance comes from the hosted runner.
- The desktop packaged-fixture timeout test in `clients/desktop/src/testing/packaged-fixture.test.ts` starts two full Node and Playwright processes, the runner and a worker. Playwright startup is over 90% of its time. On Linux CI, which runs three test suites in parallel on four CPUs, it takes a median of 4.0 s and up to 5.0 s over 55 runs, and it failed once at 5.004 s. Under CPU load it failed 14 of 14 times with the default limit and finished in 5.1–8.9 s with more time. There is no hang: the kill and the child's exit took at most 222 ms.

## Why a clean solution is not available now

Both tests exercise behavior that needs this work: a real on-disk database, and Playwright's own fixture teardown after a test timeout. Replacing them with in-memory or mocked versions would stop testing the behavior. Cheaper Playwright startup options gained 10–15% at most, which is within the noise.

## Temporary workaround

- The `createDb` seed hook and the two tests that create a fresh on-disk database get a 15 s limit on Windows only. Other platforms and the other tests in the file keep Bun's default.
- The packaged-fixture timeout test gets a 10 s limit on all platforms: 2.5 times the Linux median, and 2 times the slowest CI run.

Trade-offs: a real slowdown in these tests has to grow further before CI catches it. The limits are set per test, so every other test still fails at 5 s.

## Isolation

Only those tests set explicit limits, next to a comment that points here. Do not raise suite-wide defaults or add limits to other tests under this record.

## Removal

Remove a limit when CI runners run the test well inside 5 s (for example, a median under 2.5 s over 20 runs), or when the test no longer needs the expensive setup. Check durations in the CI logs before removing it.
