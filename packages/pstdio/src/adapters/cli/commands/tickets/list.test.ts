import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list";

describe("tickets list", () => {
  test("prints table when tickets exist", async () => {
    const log = mock();
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
          display_title: "Fix login bug",
          file_id: null,
          draft: false,
          archived: false,
          status_name: "backlog",
          tag_names: ["bug"],
          created_at: "2026-03-04T00:00:00.000Z",
        },
      ],
      log,
    });

    await handler({ _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith(expect.stringContaining("PS-1"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Fix login bug"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("backlog"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("bug"));
  });

  test("prints message when no tickets", async () => {
    const log = mock();
    const handler = createHandler({
      cwd: () => "/work/repo",
      findGitRoot: () => "/work/repo",
      readConfig: () => ({ project_id: "proj-1" }),
      listTickets: async () => [],
      log,
    });

    await handler({ _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No tickets found.");
  });
});
