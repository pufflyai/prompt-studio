import { expect, test } from "bun:test";
import { bunTestSelection, quarantinePattern, verifyQuarantineReport } from "./test-quarantine";

const cases = [
  { runner: "bun", file: "packages/db/a.test.ts", name: "keeps data (cold)", platforms: ["linux"] },
  { runner: "bun", file: "scripts/b.test.ts", name: "versions packages", platforms: ["win32"] },
  { runner: "playwright", file: "packages/e2e/a.spec.ts", name: "browser saves", platforms: ["linux"] },
];

test("quarantine selection is limited to its runner, platform and package", () => {
  const selected = bunTestSelection(cases, "packages/db", "linux", false);
  expect(new RegExp(selected.pattern!).test("keeps data (cold)")).toBe(false);
  expect(new RegExp(selected.pattern!).test("keeps data cold")).toBe(true);
  expect(new RegExp(selected.pattern!).test("ordinary behavior")).toBe(true);
  expect(bunTestSelection(cases, "scripts", "linux", false).pattern).toBeUndefined();
  expect(new RegExp(quarantinePattern(cases, "playwright", "linux")!).test("browser saves")).toBe(true);
});

test("the quarantine lane runs only registered cases and never falls back to the full suite", () => {
  const selected = bunTestSelection(cases, "packages/db", "linux", true);
  expect(selected.files).toEqual(["a.test.ts"]);
  expect(new RegExp(selected.pattern!).test("keeps data (cold)")).toBe(true);
  expect(new RegExp(selected.pattern!).test("ordinary behavior")).toBe(false);
  expect(bunTestSelection(cases, "scripts", "linux", true).files).toEqual([]);
});

test("a renamed or skipped quarantine case cannot produce a passing empty report", () => {
  expect(() => verifyQuarantineReport('<testsuites tests="4" skipped="2">', 2)).not.toThrow();
  expect(() => verifyQuarantineReport('<testsuites tests="4" skipped="4">', 2)).toThrow();
  expect(() => verifyQuarantineReport('<testsuites tests="4" skipped="3">', 2)).toThrow();
  expect(() => verifyQuarantineReport("", 2)).toThrow();
});
