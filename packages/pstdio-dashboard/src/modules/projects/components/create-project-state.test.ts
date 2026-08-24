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

  test("orders detected harnesses before undetected harnesses", () => {
    const availability = resolveProjectCreationAvailability({
      agentInfo: [
        { id: "missing", name: "Missing", availability: { type: "NOT_FOUND" } },
        { id: "codex", name: "Codex", availability: { type: "INSTALLED" } },
        { id: "other", name: "Other", availability: { type: "NOT_FOUND" } },
        { id: "claude-code", name: "Claude Code", availability: { type: "INSTALLED" } },
      ],
      isAgentsLoading: false,
      isAgentsError: false,
    });

    expect(availability.detectedHarnesses.map((harness) => harness.id)).toEqual(["codex", "claude-code"]);
    expect(availability.undetectedHarnesses.map((harness) => harness.id)).toEqual(["missing", "other"]);
    expect(availability.harnesses.map((harness) => harness.id)).toEqual(["codex", "claude-code", "missing", "other"]);
    expect(availability.shouldSelectHarness).toBe(true);
  });

  test("skips harness selection when no harness is detected", () => {
    const availability = resolveProjectCreationAvailability({
      agentInfo: [{ id: "missing", name: "Missing", availability: { type: "NOT_FOUND" } }],
      isAgentsLoading: false,
      isAgentsError: false,
    });

    expect(availability.detectedHarnesses).toEqual([]);
    expect(availability.shouldSelectHarness).toBe(false);
  });
});
