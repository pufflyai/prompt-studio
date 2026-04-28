import { describe, expect, it } from "bun:test";
import { setTicketStatus } from "./set-ticket-status";

describe("setTicketStatus", () => {
  it("updates ticket status by status name when ticket is shorthand", async () => {
    const updates: unknown[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        extensions: {
          listCollection: async (_projectId: string, _extensionId: string, collection: string) =>
            collection === "tickets"
              ? [
                  {
                    item_id: "ticket-1",
                    project_id: "proj-1",
                    value_json: { id: "ticket-1", shorthand: "PS-1" },
                    created_at: "created",
                    updated_at: "updated",
                  },
                ]
              : [
                  {
                    item_id: "status-1",
                    project_id: "proj-1",
                    value_json: { id: "status-1", name: "wip" },
                    created_at: "created",
                    updated_at: "updated",
                  },
                  {
                    item_id: "status-2",
                    project_id: "proj-1",
                    value_json: { id: "status-2", name: "review" },
                    created_at: "created",
                    updated_at: "updated",
                  },
                ],
        },
        extensionCommands: {
          execute: async (_projectId: string, commandId: string, input: unknown) => {
            updates.push({ commandId, input });
          },
        },
      },
    } as never;

    const updated = await setTicketStatus(ctx, { ticket: "PS-1", status: "review" });

    expect(updated).toBe(true);
    expect(updates).toEqual([
      {
        commandId: "pstdio.planner.updateTicket",
        input: { params: { ticket_id: "ticket-1", status_id: "status-2" } },
      },
    ]);
  });

  it("updates ticket status by status name when ticket is id", async () => {
    const updates: unknown[] = [];

    const ctx = {
      projectId: "proj-1",
      client: {
        extensions: {
          listCollection: async (_projectId: string, _extensionId: string, collection: string) =>
            collection === "tickets"
              ? [
                  {
                    item_id: "ticket-1",
                    project_id: "proj-1",
                    value_json: { id: "ticket-1", shorthand: "PS-1" },
                    created_at: "created",
                    updated_at: "updated",
                  },
                ]
              : [
                  {
                    item_id: "status-1",
                    project_id: "proj-1",
                    value_json: { id: "status-1", name: "wip" },
                    created_at: "created",
                    updated_at: "updated",
                  },
                  {
                    item_id: "status-2",
                    project_id: "proj-1",
                    value_json: { id: "status-2", name: "review" },
                    created_at: "created",
                    updated_at: "updated",
                  },
                ],
        },
        extensionCommands: {
          execute: async (_projectId: string, commandId: string, input: unknown) => {
            updates.push({ commandId, input });
          },
        },
      },
    } as never;

    const updated = await setTicketStatus(ctx, { ticket: "ticket-1", status: "review" });

    expect(updated).toBe(true);
    expect(updates).toEqual([
      {
        commandId: "pstdio.planner.updateTicket",
        input: { params: { ticket_id: "ticket-1", status_id: "status-2" } },
      },
    ]);
  });
});
