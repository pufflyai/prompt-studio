import { describe, expect, test } from "bun:test";
import { resolveEnabledSourceForRecord } from "./project-extension-runtime-snapshot";

describe("resolveEnabledSourceForRecord", () => {
  test("attributes Windows runtime entries to their installed source", () => {
    const source = {
      installedSource: { source_path: "C:\\pstdio\\extensions\\planner" },
    } as never;

    expect(resolveEnabledSourceForRecord("C:\\pstdio\\extensions\\planner\\extension.ts", [source])).toBe(source);
  });
});
