import { describe, expect, mock, test } from "bun:test";
import extension from "./extension";

const launch = extension.commands?.[0];
if (!launch) throw new Error("Remote launch command is not defined.");

describe("remote execution manual launch", () => {
  test("creates a remote workspace and starts a session with its own harness", async () => {
    const createWorkspace = mock(async () => ({ id: "workspace-1", workspace_shorthand: "REMOTE-1" }));
    const createSession = mock(async () => ({ id: "session-1" }));

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
        provider_id: "pstdio.remote-execution.workspace-type.remote",
        params: { repository: "openai/prompt-studio" },
      }),
    );
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Remote session: REMOTE-1",
        prompt: "Implement the ticket",
        workspaceId: "workspace-1",
        harness: { harnessId: "pstdio.remote-execution.harness.remote-agent" },
      }),
    );
  });
});
