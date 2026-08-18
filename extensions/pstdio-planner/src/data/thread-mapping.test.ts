import { describe, expect, test } from "bun:test";
import { inlineThreadIsOutdated } from "./thread-mapping";

describe("inline review thread mapping", () => {
  test("keeps a thread when later changes do not touch its original lines", () => {
    const diff = ["@@ -1,2 +1,3 @@", "-old", "+new", "@@ -20 +21 @@", "-tail", "+next"].join("\n");

    expect(inlineThreadIsOutdated({ startLine: 8, endLine: 10, diff })).toBe(false);
  });

  test("marks a thread outdated when its original line range changes", () => {
    const diff = ["@@ -8,3 +8,2 @@", "-one", "-two", "-three", "+next", "+value"].join("\n");

    expect(inlineThreadIsOutdated({ startLine: 8, endLine: 10, diff })).toBe(true);
  });

  test("does not invalidate a line for an insertion before it", () => {
    expect(inlineThreadIsOutdated({ startLine: 8, endLine: 8, diff: "@@ -4,0 +5,2 @@\n+one\n+two" })).toBe(false);
  });
});
