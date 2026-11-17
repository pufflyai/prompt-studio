// Whole-case allowance includes compiled-host startup, tool preparation and owned cleanup.
// Release verification exceeded 30 s on Windows and Apple Silicon (PS-1232); the user
// authorized setup/test allowances on 2026-11-17. Product budgets live in benchmarks.
export const PACKAGED_TEST_TIMEOUT = 120_000;
