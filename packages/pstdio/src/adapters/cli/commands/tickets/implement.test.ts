import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./implement";

describe("tickets implement", () => {
  test("moves ticket to wip and launches agent", async () => {
    const log = mock();
    const updateTicket = mock(async () => ({
      id: "t-1",
      shorthand: "PS-1",
      project_id: "proj-1",
      status_id: "s-wip",
      title: "Implement me",
      draft: false,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));
    const launchAgent = mock(async () => {});

    const handler = createHandler({
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "t-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: "s-1",
          title: "Implement me",
          priority: null,
          complexity: null,
          draft: false,
          archived: false,
          status_name: "backlog",
          tag_names: [],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      updateTicket,
      listTicketStatuses: async () => [{ id: "s-wip", name: "wip", color: "orange", sort_order: 3, is_default: false }],
      launchAgent,
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { status_id: "s-wip" });
    expect(log).toHaveBeenCalledWith("Ticket PS-1 moved to wip");
    expect(log).toHaveBeenCalledWith("Launching agent...");
    expect(launchAgent).toHaveBeenCalledTimes(1);
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [],
      updateTicket: async () => ({}) as never,
      listTicketStatuses: async () => [],
      launchAgent: async () => {},
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });
});
