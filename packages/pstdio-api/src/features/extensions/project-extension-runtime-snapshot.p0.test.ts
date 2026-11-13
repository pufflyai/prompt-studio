import { describe, expect, test } from "bun:test";
import { resolveEnabledSourceForRecord } from "./project-extension-runtime-snapshot";

describe("resolveEnabledSourceForRecord", () => {
  test("attributes immutable entries to their original enabled source", () => {
    const source = { installedSource: { source_path: "/extensions/planner" } } as never;
    const extension = {
      sourcePath: "/cache/revision/package/extension.ts",
      originalPackagePath: "/extensions/planner",
    } as never;
    expect(resolveEnabledSourceForRecord("/cache/revision/package/extension.ts", [source], [extension])).toBe(source);
  });
  test("attributes Windows runtime entries to their installed source", () => {
    const source = {
      installedSource: { source_path: "C:\\pstdio\\extensions\\planner" },
    } as never;

    expect(resolveEnabledSourceForRecord("C:\\pstdio\\extensions\\planner\\extension.ts", [source])).toBe(source);
  });
});
