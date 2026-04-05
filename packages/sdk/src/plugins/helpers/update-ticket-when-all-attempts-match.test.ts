import { describe, expect, it } from "bun:test";
import { updateTicketWhenAllAttemptsMatch } from "./update-ticket-when-all-attempts-match";

describe("updateTicketWhenAllAttemptsMatch", () => {
  it("updates ticket when all attempts match a target attempt status", async () => {
    const calls: { ticketId: string; input: { all_attempts_status: string; set_status: string } }[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
          updateWhenAttemptStatus: async (
            ticketId: string,
            input: { all_attempts_status: string; set_status: string },
          ) => {
            calls.push({ ticketId, input });
            return { updated: true };
          },
        },
      },
    } as never;

    const updated = await updateTicketWhenAllAttemptsMatch(ctx, {
      ticketId: "PS-1",
      allAttemptsStatus: "reviewed",
      setStatus: "review",
    });

    expect(updated).toBe(true);
    expect(calls).toEqual([
      {
        ticketId: "ticket-1",
        input: { all_attempts_status: "reviewed", set_status: "review" },
      },
    ]);
  });
});
