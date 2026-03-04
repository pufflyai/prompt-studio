import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./update";

describe("tickets update", () => {
  test("updates ticket status", async () => {
    const log = mock();
    const updateTicket = mock(async () => ({
      id: "t-1",
      shorthand: "PS-1",
      project_id: "proj-1",
      status_id: "s-wip",
      title: "Ticket",
      draft: false,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

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
          title: "Ticket",
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
      listTicketTags: async () => [],
      log,
    });

    await handler({ id: "PS-1", status: "wip", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { status_id: "s-wip" });
    expect(log).toHaveBeenCalledWith("Updated ticket PS-1");
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [],
      updateTicket: async () => ({}) as never,
      listTicketStatuses: async () => [],
      listTicketTags: async () => [],
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });

  test("throws when status not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [
        {
          id: "t-1",
          shorthand: "PS-1",
          project_id: "proj-1",
          status_id: null,
          title: "T",
          priority: null,
          complexity: null,
          draft: false,
          archived: false,
          status_name: null,
          tag_names: [],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      updateTicket: async () => ({}) as never,
      listTicketStatuses: async () => [],
      listTicketTags: async () => [],
      log: () => {},
    });

    await expect(handler({ id: "PS-1", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });
});
