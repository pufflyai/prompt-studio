import { describe, expect, it } from "bun:test";
import { getAttemptsForTicket } from "./get-attempts-for-ticket";

describe("getAttemptsForTicket", () => {
  it("lists attempts for a ticket by ticket shorthand", async () => {
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
          list: async () => [
            {
              id: "ws-1",
              workspace_shorthand: "PS-1_A1",
              anchors_json: [{ type: "pstdio.planner.ticket", id: "ticket-1", label: "PS-1" }],
            },
            {
              id: "ws-2",
              workspace_shorthand: "PS-2_A1",
              anchors_json: [{ type: "pstdio.planner.ticket", id: "ticket-2", label: "PS-2" }],
            },
            {
              id: "ws-3",
              workspace_shorthand: "PS-1_A2",
              anchors_json: [{ type: "pstdio.planner.ticket", id: "ticket-1", label: "PS-1" }],
            },
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
          list: async () => [
            {
              id: "ws-1",
              workspace_shorthand: "PS-1_A1",
              anchors_json: [{ type: "pstdio.planner.ticket", id: "ticket-1", label: "PS-1" }],
            },
          ],
        },
      },
    } as never;

    const attempts = await getAttemptsForTicket(ctx, { ticketId: "PS-99" });

    expect(attempts).toEqual([]);
  });
});
