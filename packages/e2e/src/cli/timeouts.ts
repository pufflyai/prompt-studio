// Project/API-creating CLI flows install extensions (a cold `npm install` in CI), which can
// legitimately run ~40s on a slow runner. The split e2e job has its own 15-minute budget, so
// these per-test caps are generous enough to ride out a slow install instead of flaking.
export const SETUP_TIMEOUT = 60_000;
export const TEST_TIMEOUT = 60_000;
export const FLOW_TIMEOUT = 60_000;
