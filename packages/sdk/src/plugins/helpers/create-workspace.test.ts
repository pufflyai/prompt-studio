import { describe, expect, it } from "bun:test";
import { createWorkspace } from "./create-workspace";

describe("createWorkspace", () => {
  it("creates a workspace without starting a session", async () => {
    const calls: { ticketId: string; input: { mode?: string; start_session?: boolean; base?: string } }[] = [];
    const attempt = {
      mode: "worktree",
      ticket: { id: "ticket-1" },
      workspace: { id: "ws-1" },
      session: null,
    } as never;

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
          createAttempt: async (ticketId: string, input: { mode?: string; start_session?: boolean; base?: string }) => {
            calls.push({ ticketId, input });
            return attempt;
          },
        },
      },
    } as never;

    const result = await createWorkspace(ctx, {
      ticketId: "PS-1",
      mode: "worktree",
      base: "main",
    });

    expect(result).toBe(attempt);
    expect(calls).toEqual([
      {
        ticketId: "ticket-1",
        input: { mode: "worktree", base: "main", start_session: false },
      },
    ]);
  });
});
