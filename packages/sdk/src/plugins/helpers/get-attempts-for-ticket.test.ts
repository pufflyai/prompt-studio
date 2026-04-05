import { describe, expect, it } from "bun:test";
import { getAttemptsForTicket } from "./get-attempts-for-ticket";

describe("getAttemptsForTicket", () => {
  it("lists attempts for a ticket by ticket shorthand", async () => {
    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
        },
        workspaces: {
          list: async () => [
            { id: "ws-1", ticket_shorthand: "PS-1", workspace_shorthand: "PS-1_A1" },
            { id: "ws-2", ticket_shorthand: "PS-2", workspace_shorthand: "PS-2_A1" },
            { id: "ws-3", ticket_shorthand: "PS-1", workspace_shorthand: "PS-1_A2" },
          ],
        },
      },
    } as never;

    const attempts = await getAttemptsForTicket(ctx, { ticketId: "PS-1" });

    expect(attempts.map((attempt) => attempt.id)).toEqual(["ws-1", "ws-3"]);
  });

  it("returns an empty list when the ticket cannot be resolved", async () => {
    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
        },
        workspaces: {
          list: async () => [{ id: "ws-1", ticket_shorthand: "PS-1", workspace_shorthand: "PS-1_A1" }],
        },
      },
    } as never;

    const attempts = await getAttemptsForTicket(ctx, { ticketId: "PS-99" });

    expect(attempts).toEqual([]);
  });
});
