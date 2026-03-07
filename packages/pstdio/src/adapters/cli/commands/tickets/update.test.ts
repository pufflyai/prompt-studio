import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./update";

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: "s-1",
  display_title: "Ticket",
  file_id: null,
  priority: null,
  complexity: null,
  draft: false,
  archived: false,
  status_name: "backlog",
  tag_names: [],
  created_at: "2026-03-04T00:00:00.000Z",
  ...overrides,
});

describe("tickets update", () => {
  test("updates ticket status", async () => {
    const log = mock();
    const updateTicket = mock(async () => ({}) as never);

    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket(),
      updateTicket,
      resolveStatusId: async () => "s-wip",
      resolveTagIds: async () => [],
      log,
    });

    await handler({ id: "PS-1", status: "wip", _: [], $0: "" } as never);

    expect(updateTicket).toHaveBeenCalledWith(expect.any(String), "t-1", { status_id: "s-wip" });
    expect(log).toHaveBeenCalledWith("Updated ticket PS-1");
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => null as never,
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => "",
      resolveTagIds: async () => [],
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });

  test("throws when status not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeTicket(),
      updateTicket: async () => ({}) as never,
      resolveStatusId: async () => {
        throw new Error("Status not found: nonexistent");
      },
      resolveTagIds: async () => [],
      log: () => {},
    });

    await expect(handler({ id: "PS-1", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });
});
