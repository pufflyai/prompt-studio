import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./pull";

const baseDeps = () => ({
  cwd: () => "/repo",
  resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
  pullTickets: mock(async () => ({
    pulled_ticket_shorthands: ["PS-1"],
    downloaded_file_count: 1,
    messages: ["Pulled ticket PS-1 to .pstdio/tickets/PS-1", "Downloaded 1 ticket files"],
  })),
  log: mock(),
});

describe("tickets pull", () => {
  test("delegates ticket source behavior to the planner API boundary", async () => {
    const deps = baseDeps();
    const handler = createHandler(deps);

    await handler({ id: "PS-1", force: true, _: [], $0: "" } as never);

    expect(deps.pullTickets).toHaveBeenCalledWith("proj-1", {
      ticket_id: "PS-1",
      force: true,
      repo_path: "/repo",
    });
    expect(deps.log).toHaveBeenCalledWith("Pulled ticket PS-1 to .pstdio/tickets/PS-1");
    expect(deps.log).toHaveBeenCalledWith("Downloaded 1 ticket files");
  });

  test("passes an omitted ticket id through as an all-ticket pull", async () => {
    const deps = baseDeps();
    const handler = createHandler(deps);

    await handler({ force: false, _: [], $0: "" } as never);

    expect(deps.pullTickets).toHaveBeenCalledWith("proj-1", {
      ticket_id: undefined,
      force: false,
      repo_path: "/repo",
    });
  });

  test("throws when run outside a pstdio project", async () => {
    const deps = {
      ...baseDeps(),
      resolveProjectId: () => ({ projectId: "proj-1", root: null }),
    };
    const handler = createHandler(deps);

    await expect(handler({ force: false, _: [], $0: "" } as never)).rejects.toThrow("Not inside a pstdio project");
  });
});
