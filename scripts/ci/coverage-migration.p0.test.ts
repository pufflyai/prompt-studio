import { expect, test } from "bun:test";
import { coverageMigration } from "./coverage-migration";
import { createTestPlan } from "./test-plan";

const source = { sha: "candidate", tree: "tree", policy: "policy", dirty: false };
const plan = (file: string, platform: string) =>
  createTestPlan({ source, packages: [], files: [file], target: { platform, arch: "x64" }, lane: "stable" });
test("a removed shared row names its exact Linux replacement", () => {
  const file = "clients/desktop/src/e2e/packaged-navigation-customization.p2.spec.ts";
  const report = coverageMigration(plan(file, "win32"), plan(file, "linux"));
  expect(report.complete).toBe(true);
  expect(report.rows[0]).toMatchObject({
    disposition: "consolidated",
    replacement: { file, target: { platform: "linux", arch: "x64" } },
  });
});
test("a similar name cannot replace a missing assertion, and a Linux pass cannot replace a Windows drive contract", () => {
  const file = "clients/desktop/src/e2e/packaged-folder-picker.p2.spec.ts";
  expect(coverageMigration(plan(file, "win32"), plan(file, "linux")).complete).toBe(false);
  expect(coverageMigration(plan(file, "win32"), plan("replacement.p1.test.ts", "linux")).complete).toBe(false);
});
