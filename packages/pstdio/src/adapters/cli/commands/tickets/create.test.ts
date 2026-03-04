import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./create";

describe("tickets create", () => {
  test("creates ticket and writes local ticket file", async () => {
    const log = mock();
    const writeTicketFile = mock(() => "/work/repo/.pstdio/tickets/PS-1/ticket.md");
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
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      createTicket,
      listTicketTags: async () => [],
      writeTicketFile,
      log,
    });

    await handler({ content: "New ticket", _: [], $0: "" } as never);

    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(writeTicketFile).toHaveBeenCalledWith("/work/repo", "PS-1", "# New ticket\n");
    expect(log).toHaveBeenCalledWith("Created ticket PS-1");
  });

  test("throws when not in a project", async () => {
    const handler = createHandler({
      cwd: () => "/nowhere",
      findGitRoot: () => null,
      readConfig: () => null,
      createTicket: async () => ({}) as never,
      listTicketTags: async () => [],
      writeTicketFile: () => "",
      log: () => {},
    });

    await expect(handler({ content: "Fail", _: [], $0: "" } as never)).rejects.toThrow(
      "No project specified. Provide --project-id or run inside a linked project.",
    );
  });
});
