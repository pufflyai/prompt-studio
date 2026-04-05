import { describe, expect, it } from "bun:test";
import { setTicketStatus } from "./set-ticket-status";

describe("setTicketStatus", () => {
  it("updates ticket status by status name when ticket is shorthand", async () => {
    const updates: { ticketId: string; input: { status_id: string } }[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
          update: async (ticketId: string, input: { status_id: string }) => {
            updates.push({ ticketId, input });
          },
        },
        statuses: {
          list: async () => [
            { id: "status-1", name: "wip" },
            { id: "status-2", name: "review" },
          ],
        },
      },
    } as never;

    const updated = await setTicketStatus(ctx, { ticket: "PS-1", status: "review" });

    expect(updated).toBe(true);
    expect(updates).toEqual([{ ticketId: "ticket-1", input: { status_id: "status-2" } }]);
  });

  it("updates ticket status by status name when ticket is id", async () => {
    const updates: { ticketId: string; input: { status_id: string } }[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        tickets: {
          list: async () => [{ id: "ticket-1", shorthand: "PS-1" }],
          update: async (ticketId: string, input: { status_id: string }) => {
            updates.push({ ticketId, input });
          },
        },
        statuses: {
          list: async () => [
            { id: "status-1", name: "wip" },
            { id: "status-2", name: "review" },
          ],
        },
      },
    } as never;

    const updated = await setTicketStatus(ctx, { ticket: "ticket-1", status: "review" });

    expect(updated).toBe(true);
    expect(updates).toEqual([{ ticketId: "ticket-1", input: { status_id: "status-2" } }]);
  });
});
