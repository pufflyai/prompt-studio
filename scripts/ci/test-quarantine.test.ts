import { expect, test } from "bun:test";
import {
  bunTestSelection,
  quarantinePattern,
  verifyPlaywrightQuarantineReport,
  verifyQuarantineReport,
} from "./test-quarantine";

const cases = [
  { runner: "bun", file: "packages/db/a.test.ts", name: "keeps data (cold)", platforms: ["linux"] },
  { runner: "bun", file: "scripts/b.test.ts", name: "versions packages", platforms: ["win32"] },
  { runner: "playwright", file: "packages/e2e/a.spec.ts", name: "browser saves", platforms: ["linux"] },
];

test("compiled CLI quarantine uses the built binary without selecting source Bun cases", () => {
  const entries = [
    {
      runner: "packaged-bun",
      file: "packages/e2e/src/packaged/native.test.ts",
      name: "starts browser",
      platforms: ["win32"],
    },
    { runner: "bun", file: "packages/e2e/src/source.test.ts", name: "source behavior", platforms: ["win32"] },
  ];
  const selected = bunTestSelection(entries, "packages/e2e", "win32", true, "packaged-bun");
  expect(selected.files).toEqual(["src/packaged/native.test.ts"]);
  expect(new RegExp(selected.pattern!).test("starts browser")).toBe(true);
  expect(new RegExp(selected.pattern!).test("source behavior")).toBe(false);
  expect(
    new RegExp(bunTestSelection(entries, "packages/e2e", "win32", false, "packaged-bun").pattern!).test(
      "starts browser",
    ),
  ).toBe(false);
  expect(bunTestSelection(entries, "packages/e2e", "linux", true, "packaged-bun").files).toEqual([]);
});

test("quarantine selection is limited to its runner, platform and package", () => {
  const selected = bunTestSelection(cases, "packages/db", "linux", false);
  expect(new RegExp(selected.pattern!).test("keeps data (cold)")).toBe(false);
  expect(new RegExp(selected.pattern!).test("keeps data cold")).toBe(true);
  expect(new RegExp(selected.pattern!).test("ordinary behavior")).toBe(true);
  expect(bunTestSelection(cases, "scripts", "linux", false).pattern).toBeUndefined();
  expect(new RegExp(quarantinePattern(cases, "playwright", "linux")!).test("browser saves")).toBe(true);
});

test("a native architecture quarantine leaves other machines blocking", () => {
  const cases = [
    {
      runner: "packaged-desktop",
      file: "clients/desktop/a.spec.ts",
      name: "tabs retain pages",
      platforms: ["darwin"],
      arch: "arm64",
    },
  ];
  expect(quarantinePattern(cases, "packaged-desktop", "darwin", "arm64")).toBeDefined();
  expect(
    new RegExp(quarantinePattern(cases, "packaged-desktop", "darwin", "arm64")!).test("tabs retain pages @essential"),
  ).toBe(true);
  expect(quarantinePattern(cases, "packaged-desktop", "darwin", "x64")).toBeUndefined();
  expect(quarantinePattern(cases, "packaged-desktop", "linux", "arm64")).toBeUndefined();
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

test("browser quarantine accepts a first-attempt failure but rejects skipped, retried or missing execution", () => {
  const report = (results: { status: string }[]) => ({
    suites: [{ specs: [{ title: "browser saves", tests: [{ results }] }] }],
  });
  expect(() => verifyPlaywrightQuarantineReport(report([{ status: "failed" }]), ["browser saves"])).not.toThrow();
  expect(() => verifyPlaywrightQuarantineReport(report([{ status: "passed" }]), ["browser saves"])).not.toThrow();
  expect(() => verifyPlaywrightQuarantineReport(report([{ status: "skipped" }]), ["browser saves"])).toThrow();
  expect(() =>
    verifyPlaywrightQuarantineReport(report([{ status: "failed" }, { status: "passed" }]), ["browser saves"]),
  ).toThrow();
  expect(() => verifyPlaywrightQuarantineReport(report([]), ["browser saves"])).toThrow();
  expect(() => verifyPlaywrightQuarantineReport({ suites: [], errors: ["setup failed"] }, ["browser saves"])).toThrow();
});
