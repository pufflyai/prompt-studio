import { describe, expect, test } from "bun:test";
import { resolveDashboardViewPath } from "./browser-location";

describe("resolveDashboardViewPath", () => {
  test("reads the view path after a project id", () => {
    expect(resolveDashboardViewPath("/projects/project-1/font-editor")).toBe("font-editor");
  });

  test("returns no view path for project home or unrelated URLs", () => {
    expect(resolveDashboardViewPath("/projects/project-1")).toBeUndefined();
    expect(resolveDashboardViewPath("/settings")).toBeUndefined();
  });
});
