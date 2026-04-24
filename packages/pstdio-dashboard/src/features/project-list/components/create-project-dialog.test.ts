import { describe, expect, it } from "bun:test";
import {
  canSubmitAgentSelection,
  hasProjectBasicsErrors,
  resolveInitialSelectedAgentIds,
  toggleAgentSelection,
} from "./create-project-dialog";

describe("create-project dialog behavior", () => {
  it("validates step-one project basics before moving to step two", () => {
    expect(hasProjectBasicsErrors({ name: "", repositories: [] })).toBe(true);
    expect(
      hasProjectBasicsErrors({
        name: "My Project",
        repositories: [{ path: "/repo", name: "repo", displayName: null }],
      }),
    ).toBe(false);
  });

  it("preselects all available agents and supports toggling", () => {
    const initial = resolveInitialSelectedAgentIds([{ id: "opencode" }, { id: "claude-code" }]);
    expect(initial).toEqual(["opencode", "claude-code"]);

    const deselectedAll = toggleAgentSelection(toggleAgentSelection(initial, "opencode"), "claude-code");
    expect(deselectedAll).toEqual([]);
    expect(canSubmitAgentSelection(deselectedAll)).toBe(false);

    const reselected = toggleAgentSelection(deselectedAll, "opencode");
    expect(reselected).toEqual(["opencode"]);
    expect(canSubmitAgentSelection(reselected)).toBe(true);
  });
});
