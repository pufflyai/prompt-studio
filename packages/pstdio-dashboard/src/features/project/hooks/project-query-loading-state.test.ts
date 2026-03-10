import { describe, expect, it } from "bun:test";
import { isProjectQueryLoading } from "./project-query-loading-state";

describe("isProjectQueryLoading", () => {
  it("returns true while project rows are still unresolved", () => {
    const loading = isProjectQueryLoading({
      projectId: "project-1",
      rawProject: undefined,
      isProjectLoading: false,
    });

    expect(loading).toBe(true);
  });

  it("returns false when query resolved with no rows", () => {
    const loading = isProjectQueryLoading({
      projectId: "project-1",
      rawProject: [],
      isProjectLoading: false,
    });

    expect(loading).toBe(false);
  });

  it("returns true when the live query reports loading", () => {
    const loading = isProjectQueryLoading({
      projectId: "project-1",
      rawProject: [],
      isProjectLoading: true,
    });

    expect(loading).toBe(true);
  });
});
