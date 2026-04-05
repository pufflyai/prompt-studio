import { describe, expect, it } from "bun:test";
import { createAttempt } from "./create-attempt";

describe("createAttempt", () => {
  it("creates a ticket attempt with a session for a ticket shorthand", async () => {
    const calls: { ticketId: string; input: { prompt?: string; start_session?: boolean } }[] = [];
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
          createAttempt: async (ticketId: string, input: { prompt?: string; start_session?: boolean }) => {
            calls.push({ ticketId, input });
            return attempt;
          },
        },
      },
    } as never;

    const result = await createAttempt(ctx, { ticketId: "PS-1", prompt: "Run implementation" });

    expect(result).toBe(attempt);
    expect(calls).toEqual([
      {
        ticketId: "ticket-1",
        input: { prompt: "Run implementation", start_session: true },
      },
    ]);
  });
});
