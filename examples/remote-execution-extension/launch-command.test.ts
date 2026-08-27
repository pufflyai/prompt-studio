import { describe, expect, mock, test } from "bun:test";
import extension from "./extension";

const launch = extension.commands?.[0];
if (!launch) throw new Error("Remote launch command is not defined.");

describe("remote execution manual launch", () => {
  test("is available in the command palette and launches the same workspace and session flow", async () => {
    const createWorkspace = mock(async () => ({ id: "workspace-1", workspace_shorthand: "REMOTE-1" }));
    const createSession = mock(async () => ({ id: "session-1" }));

    expect(launch.palette).toEqual([{ group: "Remote execution", label: "Launch remote session" }]);
    expect(launch.menus).toEqual([
      expect.objectContaining({
        slot: expect.objectContaining({ id: "project.headerOverflow" }),
        label: "Launch remote session",
      }),
    ]);
    await launch.run(
      {
        projectId: "project-1",
        workspaces: { create: createWorkspace },
        sessions: { create: createSession },
      } as never,
      { repository: "openai/prompt-studio", prompt: "Implement the ticket" },
    );

    expect(createWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "project-1",
        provider_id: "example.remote-execution.workspace-type.remote",
        params: { repository: "openai/prompt-studio" },
      }),
    );
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Remote session: REMOTE-1",
        prompt: "Implement the ticket",
        workspaceId: "workspace-1",
      }),
    );
  });
});
