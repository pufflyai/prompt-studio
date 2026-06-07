import { describe, expect, it } from "bun:test";

import { hasSuccessfulBunTestSummary } from "./run-tests";

describe("hasSuccessfulBunTestSummary", () => {
  it("detects a successful Bun test summary with ANSI formatting", () => {
    const output = [
      "\u001b[0m\u001b[32m 190 pass\u001b[0m",
      "\u001b[0m\u001b[2m 0 fail\u001b[0m",
      " 455 expect() calls",
      "Ran 190 tests across 28 files. \u001b[0m\u001b[2m[\u001b[1m200.64s\u001b[0m\u001b[2m]\u001b[0m",
    ].join("\n");

    expect(hasSuccessfulBunTestSummary(output)).toBe(true);
  });

  it("detects a successful summary in GitHub Actions logs", () => {
    const output = [
      "test_and_build\tTest monorepo (non-e2e)\t2026-06-07T14:36:42.2723576Z \u001b[0m\u001b[32m 192 pass\u001b[0m",
      "test_and_build\tTest monorepo (non-e2e)\t2026-06-07T14:36:42.2723863Z \u001b[0m\u001b[2m 0 fail\u001b[0m",
      "test_and_build\tTest monorepo (non-e2e)\t2026-06-07T14:36:42.2724120Z  457 expect() calls",
      "test_and_build\tTest monorepo (non-e2e)\t2026-06-07T14:36:42.2724579Z Ran 192 tests across 29 files. \u001b[0m\u001b[2m[\u001b[1m206.70s\u001b[0m\u001b[2m]\u001b[0m",
    ].join("\n");

    expect(hasSuccessfulBunTestSummary(output)).toBe(true);
  });

  it("does not treat failed summaries as successful", () => {
    const output = [" 189 pass", " 1 fail", "Ran 190 tests across 28 files."].join("\n");

    expect(hasSuccessfulBunTestSummary(output)).toBe(false);
  });
});
