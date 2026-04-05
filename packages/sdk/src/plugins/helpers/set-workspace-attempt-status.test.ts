import { describe, expect, it } from "bun:test";
import { setWorkspaceAttemptStatus } from "./set-workspace-attempt-status";

describe("setWorkspaceAttemptStatus", () => {
  it("updates workspace attempt status by workspace shorthand", async () => {
    const updates: { workspaceId: string; input: { status: string; session_id?: string } }[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        workspaces: {
          list: async () => [{ id: "ws-1", workspace_shorthand: "PS-1_A1" }],
          updateAttemptStatus: async (workspaceId: string, input: { status: string; session_id?: string }) => {
            updates.push({ workspaceId, input });
          },
        },
      },
    } as never;

    const updated = await setWorkspaceAttemptStatus(ctx, {
      workspaceId: "PS-1_A1",
      statusName: "wip",
      sessionId: "sess-1",
    });

    expect(updated).toBe(true);
    expect(updates).toEqual([{ workspaceId: "ws-1", input: { status: "wip", session_id: "sess-1" } }]);
  });
});
