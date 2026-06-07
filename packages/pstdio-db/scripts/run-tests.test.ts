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

  it("does not treat failed summaries as successful", () => {
    const output = [" 189 pass", " 1 fail", "Ran 190 tests across 28 files."].join("\n");

    expect(hasSuccessfulBunTestSummary(output)).toBe(false);
  });
});
