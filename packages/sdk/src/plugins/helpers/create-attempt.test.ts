import { describe, expect, it } from "bun:test";
import { createAttempt } from "./create-attempt";

describe("createAttempt", () => {
  it("creates a ticket attempt with a session for a ticket shorthand", async () => {
    const calls: unknown[] = [];
    const workspace = { id: "ws-1" } as never;
    const session = { id: "session-1" } as never;

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
            calls.push({ method: "workspaces.create", input });
            return workspace;
          },
        },
        sessions: {
          create: async (input: unknown) => {
            calls.push({ method: "sessions.create", input });
            return session;
          },
        },
      },
    } as never;

    const result = await createAttempt(ctx, { ticketId: "PS-1", prompt: "Run implementation" });

    expect(result).toEqual({ ticket: expect.objectContaining({ id: "ticket-1" }), workspace, session });
    expect(calls).toEqual([
      {
        method: "workspaces.create",
        input: {
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
      },
      {
        method: "sessions.create",
        input: {
          project_id: "proj-1",
          title: "PS-1",
          prompt: "Run implementation",
          workspace_id: "ws-1",
        },
      },
    ]);
  });
});
