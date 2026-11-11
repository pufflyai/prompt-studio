import { expect, test } from "bun:test";
import { countTests, isTestJob } from "./test-counts";

test("counts Bun and Playwright summaries without counting assertion errors or job outcomes", () => {
  expect(
    countTests(
      " 22 pass\n 1 fail\n 2 skip\nRan 25 tests across 3 files.\n  1 failed\n    spec.ts › failed scenario\n  3 skipped\n  28 passed (5.9m)\n",
    ),
  ).toEqual({ passed: 50, failed: 2, skipped: 5, reports: 2 });
});
test("accepts timestamped colored logs and failed suites with no passed cases", () => {
  expect(
    countTests("2026-11-11T19:00:00Z \u001b[1A\u001b[2K  1 failed\n2026-11-11T19:00:01Z   5 did not run\n"),
  ).toEqual({ passed: 0, failed: 1, skipped: 5, reports: 1 });
});
test("missing reports stay unknown, and skipped suites do not become successes", () => {
  expect(countTests("setup failed\n##[error]Process completed with exit code 1")).toEqual({
    passed: 0,
    failed: 0,
    skipped: 0,
    reports: 0,
  });
  expect(countTests("  4 skipped\n")).toEqual({ passed: 0, failed: 0, skipped: 4, reports: 1 });
});
test("selects test jobs and excludes builds, publishers, and aggregate failure gates", () => {
  for (const name of [
    "production / functional / e2e_P1 (2/2)",
    "production / signed_functional / functional (linux-x64)",
    "production / functional / package_checks (1/4)",
    "production / performance / desktop / performance (linux-x64)",
  ])
    expect(isTestJob(name)).toBe(true);
  for (const name of [
    "production / functional / published_extensions",
    "release_build",
    "publish_nightly",
    "production / certify",
    "production / functional / validation_results",
    "production / functional / build_clients (linux-x64)",
  ])
    expect(isTestJob(name)).toBe(false);
});
