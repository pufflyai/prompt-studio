import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./save";

const baseDeps = () => ({
  cwd: () => "/repo",
  resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" }),
  pushTicket: mock(async () => ({
    ticket_id: "PS-1",
    uploaded_file_count: 1,
    messages: ["Saved ticket PS-1", "Uploaded 1 ticket files"],
  })),
  log: mock(),
});

describe("tickets save", () => {
  test("delegates ticket source behavior to the planner API boundary", async () => {
    const deps = baseDeps();
    const handler = createHandler(deps);

    await handler({ id: "PS-1", status: "wip", tag: ["bug"], _: [], $0: "" } as never);

    expect(deps.pushTicket).toHaveBeenCalledWith("proj-1", {
      ticket_id: "PS-1",
      repo_path: "/repo",
      status: "wip",
      tags: ["bug"],
    });
    expect(deps.log).toHaveBeenCalledWith("Saved ticket PS-1");
    expect(deps.log).toHaveBeenCalledWith("Uploaded 1 ticket files");
  });

  test("throws when run outside a pstdio project", async () => {
    const deps = {
      ...baseDeps(),
      resolveProjectId: () => ({ projectId: "proj-1", root: null }),
    };
    const handler = createHandler(deps);

    await expect(handler({ id: "PS-1", _: [], $0: "" } as never)).rejects.toThrow("Not inside a pstdio project");
  });
});
