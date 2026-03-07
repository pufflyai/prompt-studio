import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./create";

const baseDeps = {
  cwd: () => "/work/repo",
  resolveProjectId: () => ({ projectId: "proj-1", root: "/work/repo" }),
  readConfig: (_root: string) => ({ project_id: "proj-1" }) as { project_id: string } | null,
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
  test("creates ticket with draft=false", async () => {
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

    const handler = createHandler({
      ...baseDeps,
      createTicket,
      log: mock(),
    });

    await handler({ content: "New ticket", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ draft: false }));
  });

  test("writes local file with frontmatter when in a pstdio project", async () => {
    const writeTicketFile = mock((_root: string, _shorthand: string, _content: string) => "");
    const log = mock();

    const handler = createHandler({
      ...baseDeps,
      readConfig: () => ({ project_id: "proj-1" }),
      writeTicketFile,
      log,
    });

    await handler({ content: "New ticket", _: [], $0: "" } as never);

    expect(writeTicketFile).toHaveBeenCalledTimes(1);
    const content = writeTicketFile.mock.calls[0][2];
    expect(content).toStartWith("---\n");
    expect(content).toContain('ticket_id: "PS-1"');
    expect(content).toContain('created: "2026-03-04T00:00:00.000Z"');
    expect(content).toContain("# New ticket");
  });

  test("does not write local file when not in a pstdio project", async () => {
    const writeTicketFile = mock(() => "");
    const log = mock();

    const handler = createHandler({
      ...baseDeps,
      resolveProjectId: (_, explicitId) => ({ projectId: explicitId!, root: null }),
      readConfig: () => null,
      writeTicketFile,
      log,
    });

    await handler({ content: "New ticket", "project-id": "proj-1", _: [], $0: "" } as never);

    expect(writeTicketFile).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Created ticket PS-1");
  });

  test("does not write local file when root exists but no config", async () => {
    const writeTicketFile = mock(() => "");
    const log = mock();

    const handler = createHandler({
      ...baseDeps,
      resolveProjectId: (_, explicitId) => ({ projectId: explicitId!, root: "/work/repo" }),
      readConfig: () => null,
      writeTicketFile,
      log,
    });

    await handler({ content: "New ticket", "project-id": "proj-1", _: [], $0: "" } as never);

    expect(writeTicketFile).not.toHaveBeenCalled();
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

  test("includes status in frontmatter when --status is provided", async () => {
    const writeTicketFile = mock((_root: string, _shorthand: string, _content: string) => "");

    const handler = createHandler({
      ...baseDeps,
      createTicket: mock(async () => ({
        id: "t-2",
        shorthand: "PS-2",
        project_id: "proj-1",
        status_id: "s-wip",
        title: "Status ticket",
        draft: false,
        created_at: "2026-03-04T00:00:00.000Z",
        updated_at: "2026-03-04T00:00:00.000Z",
      })),
      writeTicketFile,
      log: mock(),
    });

    await handler({ content: "Status ticket", status: "wip", _: [], $0: "" } as never);

    const content = writeTicketFile.mock.calls[0][2];
    expect(content).toContain('status: "wip"');
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
