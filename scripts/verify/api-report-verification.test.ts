import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createApiFixture, writeFixtureApi } from "./api-report-fixture";
import { verifyApiReport } from "./verify-extension-api-report";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("API comparison from source", () => {
  test("accepts unchanged APIs without a version bump", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    const result = verifyApiReport(root);
    expect(result.errors).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(existsSync(join(root, ".api-report/released/extensions.d.ts"))).toBe(true);
    expect(existsSync(join(root, ".api-report/proposed/extensions.d.ts"))).toBe(true);
  });

  test("requires a version bump and retains a diff for review", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    writeFixtureApi(root, "0.4.0", "number");
    const result = verifyApiReport(root);
    expect(result.changed).toEqual(["extensions"]);
    expect(result.errors).toHaveLength(1);
    expect(readFileSync(join(root, ".api-report/api.diff"), "utf8").length).toBeGreaterThan(0);
    expect(existsSync(join(root, ".api-report/summary.md"))).toBe(true);
  });

  test("accepts a version bump already made for this release", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    writeFixtureApi(root, "0.5.0", "number");
    expect(verifyApiReport(root).errors).toEqual([]);
  });

  test("fails when declarations cannot be generated", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    writeFileSync(join(root, "packages/sdk/src/extensions/index.ts"), 'export * from "./missing";');
    expect(() => verifyApiReport(root)).toThrow("API report generation failed");
  });
});
