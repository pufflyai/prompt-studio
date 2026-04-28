import { describe, expect, it } from "bun:test";
import { createWorkspace } from "./create-workspace";

describe("createWorkspace", () => {
  it("creates a workspace without starting a session", async () => {
    const calls: unknown[] = [];
    const workspace = { id: "ws-1" } as never;

    const ctx = {
      projectId: "proj-1",
      client: {
        extensions: {
          listCollection: async () => [
            {
              item_id: "ticket-1",
              project_id: "proj-1",
              value_json: { id: "ticket-1", shorthand: "PS-1" },
              created_at: "created",
              updated_at: "updated",
            },
          ],
        },
        workspaces: {
          create: async (input: unknown) => {
            calls.push(input);
            return workspace;
          },
        },
      },
    } as never;

    const result = await createWorkspace(ctx, {
      ticketId: "PS-1",
      mode: "worktree",
      base: "main",
    });

    expect(result).toBe(workspace);
    expect(calls).toEqual([
      {
        project_id: "proj-1",
        anchors: [
          {
            type: "pstdio.planner.ticket",
            id: "ticket-1",
            label: "PS-1",
            extensionId: "pstdio.planner",
            role: "primary",
          },
        ],
      },
    ]);
  });
});
