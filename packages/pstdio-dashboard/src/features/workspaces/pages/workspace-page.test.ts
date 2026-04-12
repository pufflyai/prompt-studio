import { describe, expect, it, mock } from "bun:test";
import { createWorkspaceSessionHandler } from "./workspace-page";

describe("WorkspacePage", () => {
  it("passes the selected workspace payload to the workspace-session mutation", async () => {
    const createWorkspaceSession = mock(async () => ({ sessionId: "session-1" }));
    const onCreated = mock(() => {});

    const handleCreateWorkspaceSession = createWorkspaceSessionHandler({
      ticket: { shorthand: "PS-13" },
      attempts: [
        { id: "workspace-1", shorthand: "PS-13_A1" },
        { id: "workspace-2", shorthand: "PS-13_A2" },
      ],
      lastSelectedAgent: "opencode",
      lastSelectedModels: ["gpt-5.3"],
      createWorkspaceSession,
      onCreated,
    });

    await handleCreateWorkspaceSession("PS-13_A2");

    expect(createWorkspaceSession).toHaveBeenCalledWith({
      workspaceId: "workspace-2",
      prompt: "Implement ticket: PS-13",
      agent: "opencode",
      model: "gpt-5.3",
    });
    expect(onCreated).toHaveBeenCalledWith("session-1");
  });
});
