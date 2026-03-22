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
      resolveTicketByShorthand: async () => makeListItem(),
      getTicket: async () => makeTicket(),
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
      resolveTicketByShorthand: async () => makeListItem({ tag_names: [], status_name: null }),
      getTicket: async () => makeTicket(),
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
      resolveTicketByShorthand: async () => makeListItem(),
      getTicket: async () => makeTicket(),
      log: mock(),
    });

    await handler({ id: "PS-1", "project-id": "custom-proj", _: [], $0: "" } as never);

    expect(resolveProjectId).toHaveBeenCalledWith("/work/repo", "custom-proj");
  });

  test("throws when ticket not found", async () => {
    const handler = createHandler({
      cwd: () => "/work/repo",
      resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
      resolveTicketByShorthand: async () => null as never,
      getTicket: async () => null,
      log: () => {},
    });

    await expect(handler({ id: "PS-999", _: [], $0: "" } as never)).rejects.toThrow("Ticket not found: PS-999");
  });
});
