// The slowest CI runs of the tests using these were 9 s (TEST), 4.3 s (SETUP) and 3.7 s (FLOW)
// across four nightlies and five queue runs, with CI's warm install cache (PS-1005). 30 s lets a
// hang fail near the tests' real duration. TEST_TIMEOUT also bounds the helpers' subprocesses.
export const SETUP_TIMEOUT = 30_000;
export const TEST_TIMEOUT = 30_000;
export const FLOW_TIMEOUT = 30_000;
