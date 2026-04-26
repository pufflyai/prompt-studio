import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./view";

const makeListItem = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: "s-1",
  display_title: "Fix login bug",
  file_id: null,
  draft: false,
  archived: false,
  status_name: "backlog",
  tag_names: ["bug"],
  created_at: "2026-01-15T10:00:00Z",
  ...overrides,
});

const makeTicket = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: "s-1",
  display_title: "Fix login bug",
  user_prompt: null,
  file_id: null,
  parent_id: null,
  parallelizable: null,
  blocked_reason: null,
  depends_on: null,
  draft: false,
  archived: false,
  deleted_at: null,
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-01-20T14:30:00Z",
  ...overrides,
});

describe("tickets view", () => {
  test("displays ticket summary", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem() as never,
      getTicket: async () => makeTicket() as never,
      listTickets: async () => [] as never,
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("PS-1"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Fix login bug"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("backlog"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("bug"));
  });

  test("shows dash for missing tags", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ tag_names: [], status_name: null }) as never,
      getTicket: async () => makeTicket() as never,
      listTickets: async () => [] as never,
      log,
    });

    await handler({ id: "PS-1", _: [], $0: "" } as never);

    const calls = log.mock.calls.map((c) => c[0] as string);
    const tagsLine = calls.find((c) => c.startsWith("Tags:"));
    expect(tagsLine).toContain("-");
  });

  test("passes --project-id override to resolveProjectId", async () => {
    const resolveProjectId = mock(() => ({ projectId: "custom-proj", root: "/work/repo" }));
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId,
      resolveTicketByShorthand: async () => makeListItem() as never,
      getTicket: async () => makeTicket() as never,
      listTickets: async () => [] as never,
      log: mock(),
    });

    await handler({ id: "PS-1", "project-id": "custom-proj", _: [], $0: "" } as never);

    expect(resolveProjectId).toHaveBeenCalledWith("/work/repo", "custom-proj");
  });

  test("outputs only status when field is 'status'", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ status_name: "review" }) as never,
      getTicket: async () => makeTicket() as never,
      listTickets: async () => [] as never,
      log,
    });

    await handler({ id: "PS-1", field: "status", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("review");
  });

  test("outputs only title when field is 'title'", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem() as never,
      getTicket: async () => makeTicket({ display_title: "Fix login bug" }) as never,
      listTickets: async () => [] as never,
      log,
    });

    await handler({ id: "PS-1", field: "title", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Fix login bug");
  });

  test("outputs only tags when field is 'tags'", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ tag_names: ["bug", "urgent"] }) as never,
      getTicket: async () => makeTicket() as never,
      listTickets: async () => [] as never,
      log,
    });

    await handler({ id: "PS-1", field: "tags", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("bug, urgent");
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => null as never,
      getTicket: async () => null as never,
      listTickets: async () => [] as never,
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });
});

describe("tickets view relationship fields", () => {
  test("keeps relationship fields out of ticket summary", async () => {
    const log = mock();
    const childTicket = makeTicket({ id: "t-2", shorthand: "PS-2", parent_id: "ticket-parent-id" });
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ id: "t-2", shorthand: "PS-2" }) as never,
      getTicket: async () => childTicket as never,
      listTickets: async () => [makeListItem({ id: "t-3", shorthand: "PS-3" })] as never,
      log,
    } as never);

    await handler({ id: "PS-2", _: [], $0: "" } as never);

    expect(log.mock.calls.map((call) => call[0])).toEqual([
      "Shorthand:   PS-2",
      "Title:       Fix login bug",
      "Status:      backlog",
      "Tags:        bug",
      "Created:     2026-01-15T10:00:00Z",
      "Updated:     2026-01-20T14:30:00Z",
    ]);
  });

  test("outputs parent shorthand when field is 'parent-ticket'", async () => {
    const log = mock();
    const childTicket = makeTicket({ id: "t-2", shorthand: "PS-2", parent_id: "ticket-parent-id" });
    const parentTicket = makeTicket({ id: "ticket-parent-id", shorthand: "PS-1" });
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ id: "t-2", shorthand: "PS-2" }) as never,
      getTicket: async (id: string) => {
        if (id === "t-2") return childTicket as never;
        if (id === "ticket-parent-id") return parentTicket as never;
        return null as never;
      },
      listTickets: async () => [] as never,
      log,
    } as never);

    await handler({ id: "PS-2", field: "parent-ticket", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("PS-1");
  });

  test("falls back to shorthand lookup when parent-ticket stores a shorthand", async () => {
    const log = mock();
    const childTicket = makeTicket({ id: "t-2", shorthand: "PS-2", parent_id: "PS-1" });
    const resolveTicketByShorthand = mock(async (_projectId: string, shorthand: string) => {
      if (shorthand === "PS-2") return makeListItem({ id: "t-2", shorthand: "PS-2" }) as never;
      if (shorthand === "PS-1") return makeListItem({ id: "t-1", shorthand: "PS-1" }) as never;
      return null as never;
    });

    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand,
      getTicket: async (id: string) => {
        if (id === "t-2") return childTicket as never;
        return null as never;
      },
      listTickets: async () => [] as never,
      log,
    } as never);

    await handler({ id: "PS-2", field: "parent-ticket", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("PS-1");
    expect(resolveTicketByShorthand).toHaveBeenCalledWith("proj-1", "PS-1");
  });

  test("outputs empty string when field is 'parent-ticket' and no parent exists", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem() as never,
      getTicket: async () => makeTicket({ parent_id: null }) as never,
      listTickets: async () => [] as never,
      log,
    } as never);

    await handler({ id: "PS-1", field: "parent-ticket", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("");
  });

  test("outputs sorted, deduplicated draft and non-draft child shorthands when field is 'sub-tickets'", async () => {
    const log = mock();
    const listTickets = mock(async ({ parent_id, draft }: { parent_id?: string; draft?: boolean }) => {
      if (parent_id === "t-1" && draft === false) {
        return [
          makeListItem({ id: "t-3", shorthand: "PS-3" }),
          makeListItem({ id: "t-2", shorthand: "PS-2" }),
        ] as never;
      }

      if (parent_id === "t-1" && draft === true) {
        return [makeListItem({ id: "t-5", shorthand: "PS-5", draft: true })] as never;
      }

      if (parent_id === "PS-1" && draft === false) {
        return [
          makeListItem({ id: "t-2", shorthand: "PS-2" }),
          makeListItem({ id: "t-4", shorthand: "PS-4" }),
        ] as never;
      }

      if (parent_id === "PS-1" && draft === true) {
        return [
          makeListItem({ id: "t-10", shorthand: "PS-10", draft: true }),
          makeListItem({ id: "t-6", shorthand: "PS-6", draft: true }),
        ] as never;
      }

      return [] as never;
    });

    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ id: "t-1", shorthand: "PS-1" }) as never,
      getTicket: async () => makeTicket({ id: "t-1", shorthand: "PS-1" }) as never,
      listTickets,
      log,
    } as never);

    await handler({ id: "PS-1", field: "sub-tickets", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("PS-2, PS-3, PS-4, PS-5, PS-6, PS-10");
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "t-1", draft: false });
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "t-1", draft: true });
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "PS-1", draft: false });
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "PS-1", draft: true });
  });

  test("outputs empty string when field is 'sub-tickets' and no children exist", async () => {
    const log = mock();
    const listTickets = mock(async () => [] as never);
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem({ id: "t-5", shorthand: "PS-5" }) as never,
      getTicket: async () => makeTicket({ id: "t-5", shorthand: "PS-5" }) as never,
      listTickets,
      log,
    } as never);

    await handler({ id: "PS-5", field: "sub-tickets", _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("");
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "t-5", draft: false });
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "t-5", draft: true });
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "PS-5", draft: false });
    expect(listTickets).toHaveBeenCalledWith({ project_id: "proj-1", parent_id: "PS-5", draft: true });
  });

  test("includes parent and sub-ticket fields in unknown field error", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => makeListItem() as never,
      getTicket: async () => makeTicket() as never,
      listTickets: async () => [] as never,
      log: mock(),
    } as never);

    await expect(handler({ id: "PS-1", field: "unknown", _: [], $0: "" } as never)).rejects.toThrow(
      "Unknown field: unknown. Valid fields: shorthand, title, status, tags, parent-ticket, sub-tickets",
    );
  });
});
