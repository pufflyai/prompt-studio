import { describe, expect, test } from "bun:test";
import { resolveDashboardProjectState } from "./app";

describe("resolveDashboardProjectState", () => {
  test("uses a known project id from the URL", () => {
    expect(resolveDashboardProjectState([{ id: "project-1" }], "project-1", true)).toEqual({
      status: "ready",
      projectId: "project-1",
    });
  });

  test("does not fall back to the first project for unknown URL project ids", () => {
    expect(resolveDashboardProjectState([{ id: "project-1" }], "missing-project", true)).toEqual({
      status: "not-found",
    });
  });

  test("falls back to the first project only when the URL has no project id", () => {
    expect(resolveDashboardProjectState([{ id: "project-1" }], undefined, true)).toEqual({
      status: "ready",
      projectId: "project-1",
    });
  });

  test("keeps direct project links loading until synced projects arrive", () => {
    expect(resolveDashboardProjectState([], "project-1", false)).toEqual({ status: "loading" });
  });

  test("reports missing direct project links after synced projects are loaded", () => {
    expect(resolveDashboardProjectState([], "project-1", true)).toEqual({ status: "not-found" });
  });

  test("reports an empty project list only when no URL project id is present", () => {
    expect(resolveDashboardProjectState([], undefined, true)).toEqual({ status: "empty" });
  });

  test("keeps empty project lists loading until synced projects are loaded", () => {
    expect(resolveDashboardProjectState([], undefined, false)).toEqual({ status: "loading" });
  });
});
