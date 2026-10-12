// Hosted Intel macOS runners run the packaged suite two to three times slower than Apple Silicon and
// Linux, and one Intel run can take twice as long as another. On 2026-10-12, tests that pass in
// 11-23 s on Intel timed out at 30 s on a slow runner. The user approved 60 s on Intel, matching the
// desktop suites (approved 2026-10-10); other platforms keep 30 s.
export const PACKAGED_TEST_TIMEOUT = process.platform === "darwin" && process.arch === "x64" ? 60_000 : 30_000;
