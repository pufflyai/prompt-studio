import { describe, expect, test } from "bun:test";
import {
  canSubmitAgentSelection,
  hasProjectBasicsErrors,
  resolveInitialSelectedAgentIds,
  resolveProjectCreationAvailability,
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

  test("does not block project creation when no agents are installed", () => {
    const availability = resolveProjectCreationAvailability({
      agentInfo: [],
      isAgentsLoading: false,
      isAgentsError: false,
    });

    expect(availability.hasNoAgents).toBe(true);
    expect(availability.isCreateProjectBlocked).toBe(false);
  });

  test("blocks project creation while agents are loading or failed to load", () => {
    const loading = resolveProjectCreationAvailability({
      agentInfo: [],
      isAgentsLoading: true,
      isAgentsError: false,
    });
    const errored = resolveProjectCreationAvailability({
      agentInfo: [],
      isAgentsLoading: false,
      isAgentsError: true,
    });

    expect(loading.isCreateProjectBlocked).toBe(true);
    expect(errored.isCreateProjectBlocked).toBe(true);
  });
});
