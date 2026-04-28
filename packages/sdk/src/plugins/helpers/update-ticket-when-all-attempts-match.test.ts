import { describe, expect, it } from "bun:test";
import { updateTicketWhenAllAttemptsMatch } from "./update-ticket-when-all-attempts-match";

describe("updateTicketWhenAllAttemptsMatch", () => {
  it("updates ticket when all attempts match a target attempt status", async () => {
    const calls: unknown[] = [];

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
        extensionCommands: {
          execute: async (_projectId: string, commandId: string, input: unknown) => {
            calls.push({ commandId, input });
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
        commandId: "pstdio.planner.updateTicketWhenAttemptStatus",
        input: {
          params: {
            ticket_id: "ticket-1",
            all_attempts_status: "reviewed",
            set_status: "review",
          },
        },
      },
    ]);
  });
});
