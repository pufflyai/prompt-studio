import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./create";

const baseDeps = {
  cwd: () => "/work/repo",
  findGitRoot: () => "/work/repo",
  resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
  createTicket: mock(async () => ({
    id: "t-1",
    shorthand: "PS-1",
    project_id: "proj-1",
    status_id: null,
    title: "New ticket",
    draft: false,
    created_at: "2026-03-04T00:00:00.000Z",
    updated_at: "2026-03-04T00:00:00.000Z",
  })),
  resolveStatusId: async (_url: string, _pid: string, name: string) => {
    const statuses: Record<string, string> = { backlog: "s-backlog", wip: "s-wip" };
    const id = statuses[name];
    if (!id) throw new Error(`Status not found: ${name}`);
    return id;
  },
  resolveTagIds: async () => [] as string[],
  writeTicketFile: mock(() => "/work/repo/.pstdio/tickets/PS-1/ticket.md"),
  log: mock(),
};

describe("tickets create", () => {
  test("creates ticket and writes local ticket file", async () => {
    const createTicket = mock(async () => ({
      id: "t-1",
      shorthand: "PS-1",
      project_id: "proj-1",
      status_id: null,
      title: "New ticket",
      draft: false,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));
    const writeTicketFile = mock(() => "/work/repo/.pstdio/tickets/PS-1/ticket.md");
    const log = mock();

    const handler = createHandler({
      ...baseDeps,
      createTicket,
      writeTicketFile,
      log,
    });

    await handler({ content: "New ticket", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(writeTicketFile).toHaveBeenCalledWith("/work/repo", "PS-1", "# New ticket\n");
    expect(log).toHaveBeenCalledWith("Created ticket PS-1");
  });

  test("passes status_id when --status is provided", async () => {
    const createTicket = mock(async () => ({
      id: "t-2",
      shorthand: "PS-2",
      project_id: "proj-1",
      status_id: "s-wip",
      title: "Status ticket",
      draft: false,
      created_at: "2026-03-04T00:00:00.000Z",
      updated_at: "2026-03-04T00:00:00.000Z",
    }));

    const handler = createHandler({
      ...baseDeps,
      createTicket,
      writeTicketFile: mock(() => ""),
      log: mock(),
    });

    await handler({ content: "Status ticket", status: "wip", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status_id: "s-wip" }));
  });

  test("throws when status not found", async () => {
    const handler = createHandler({
      ...baseDeps,
      log: mock(),
    });

    await expect(handler({ content: "Fail", status: "nonexistent", _: [], $0: "" } as never)).rejects.toThrow(
      "Status not found: nonexistent",
    );
  });

  test("throws when not in a project", async () => {
    const handler = createHandler({
      ...baseDeps,
      resolveProjectId: () => {
        throw new Error("No project specified. Provide --project-id or run inside a linked project.");
      },
      log: () => {},
    });

    await expect(handler({ content: "Fail", _: [], $0: "" } as never)).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });
});
