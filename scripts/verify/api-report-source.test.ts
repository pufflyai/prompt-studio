import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createApiFixture } from "./api-report-fixture";
import { readApiEntries, withReleaseSource } from "./api-report-source";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("released API sources", () => {
  test("reads released exports before the public inventory existed", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    expect(readApiEntries(root)).toEqual(["extensions"]);
    writeFileSync(join(root, "packages/sdk/api-report-entries.json"), '["data"]');
    expect(readApiEntries(root)).toEqual(["data"]);
  });

  test("reads the tagged source and removes its temporary checkout", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    writeFileSync(join(root, "packages/sdk/src/extensions/index.ts"), "export const changed = true;");
    let checkout = "";
    withReleaseSource(root, "pstdio@0.4.0", (source) => {
      checkout = source;
      expect(readFileSync(join(source, "packages/sdk/src/extensions/index.ts"), "utf8")).not.toContain("changed");
    });
    expect(existsSync(checkout)).toBe(false);
  });

  test("cleans up after a failed baseline build", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    let checkout = "";
    expect(() =>
      withReleaseSource(root, "pstdio@0.4.0", (source) => {
        checkout = source;
        throw new Error("Cannot generate declarations");
      }),
    ).toThrow("Cannot generate declarations");
    expect(existsSync(checkout)).toBe(false);
  });

  test("reports a missing release instead of accepting it as unchanged", () => {
    const { root, cleanup } = createApiFixture();
    cleanups.push(cleanup);
    expect(() => withReleaseSource(root, "pstdio@missing", () => {})).toThrow();
  });
});
