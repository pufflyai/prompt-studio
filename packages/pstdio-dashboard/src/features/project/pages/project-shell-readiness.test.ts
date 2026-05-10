import { describe, expect, it } from "bun:test";
import { shouldRenderProjectOutlet } from "./project-shell-readiness";

describe("shouldRenderProjectOutlet", () => {
  it("renders child routes while the project record is still loading", () => {
    expect(
      shouldRenderProjectOutlet({
        projectId: "project-1",
        hasProject: false,
        isProjectLoading: true,
      }),
    ).toBe(true);
  });

  it("does not render child routes after the project resolves as missing", () => {
    expect(
      shouldRenderProjectOutlet({
        projectId: "project-1",
        hasProject: false,
        isProjectLoading: false,
      }),
    ).toBe(false);
  });
});
