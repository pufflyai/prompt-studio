import { describe, expect, it } from "bun:test";
import { resolveCreateWorkspaceSessionInput } from "./create-workspace-session-input";

describe("resolveCreateWorkspaceSessionInput", () => {
  it("uses the selected workspace shorthand to target the right workspace", () => {
    const input = resolveCreateWorkspaceSessionInput({
      attempts: [
        { id: "ws-1", shorthand: "PS-13_A1" },
        { id: "ws-2", shorthand: "PS-13_A2" },
      ],
      workspaceShorthand: "PS-13_A2",
      ticketShorthand: "PS-13",
      lastSelectedAgent: "claude-code",
      lastSelectedModels: ["sonnet"],
    });

    expect(input).toEqual({
      workspaceId: "ws-2",
      prompt: "Implement ticket: PS-13",
      agent: "claude-code",
      model: "sonnet",
    });
  });

  it("falls back to default agent and omits blank model", () => {
    const input = resolveCreateWorkspaceSessionInput({
      attempts: [{ id: "ws-1", shorthand: "PS-13_A1" }],
      workspaceShorthand: "PS-13_A1",
      ticketShorthand: "PS-13",
      lastSelectedAgent: null,
      lastSelectedModels: ["   "],
    });

    expect(input).toEqual({
      workspaceId: "ws-1",
      prompt: "Implement ticket: PS-13",
      agent: "opencode",
      model: null,
    });
  });
});
