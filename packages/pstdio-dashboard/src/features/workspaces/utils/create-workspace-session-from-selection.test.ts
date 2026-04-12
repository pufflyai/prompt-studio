import { describe, expect, it, mock } from "bun:test";
import { createWorkspaceSessionFromSelection } from "./create-workspace-session-from-selection";

describe("createWorkspaceSessionFromSelection", () => {
  it("creates a session for the selected workspace shorthand", async () => {
    const createWorkspaceSession = mock(async () => ({ sessionId: "session-123" }));
    const onCreated = mock(() => {});

    await createWorkspaceSessionFromSelection({
      attempts: [
        { id: "ws-1", shorthand: "PS-13_A1" },
        { id: "ws-2", shorthand: "PS-13_A2" },
      ],
      workspaceShorthand: "PS-13_A2",
      ticketShorthand: "PS-13",
      lastSelectedAgent: "opencode",
      lastSelectedModels: ["gpt-5.4"],
      createWorkspaceSession,
      onCreated,
    });

    expect(createWorkspaceSession).toHaveBeenCalledWith({
      workspaceId: "ws-2",
      prompt: "Implement ticket: PS-13",
      agent: "opencode",
      model: "gpt-5.4",
    });
    expect(onCreated).toHaveBeenCalledWith("session-123");
  });
});
