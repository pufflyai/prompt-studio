import { describe, expect, test } from "bun:test";
import {
  canSubmitAgentSelection,
  hasProjectBasicsErrors,
  resolveInitialSelectedAgentIds,
  toggleAgentSelection,
} from "./create-project-state";

describe("dashboard workbench create project state", () => {
  test("requires a project name and at least one repository before agent selection", () => {
    expect(hasProjectBasicsErrors({ name: "", repositories: [] })).toBe(true);
    expect(
      hasProjectBasicsErrors({
        name: "Prompt Studio",
        repositories: [{ path: "/repo", name: "repo", displayName: null }],
      }),
    ).toBe(false);
  });

  test("preselects installed agents and supports toggling them", () => {
    const initial = resolveInitialSelectedAgentIds([{ id: "opencode" }, { id: "claude-code" }]);
    expect(initial).toEqual(["opencode", "claude-code"]);

    const deselected = toggleAgentSelection(toggleAgentSelection(initial, "opencode"), "claude-code");
    expect(deselected).toEqual([]);
    expect(canSubmitAgentSelection(deselected)).toBe(false);

    const reselected = toggleAgentSelection(deselected, "opencode");
    expect(reselected).toEqual(["opencode"]);
    expect(canSubmitAgentSelection(reselected)).toBe(true);
  });
});
