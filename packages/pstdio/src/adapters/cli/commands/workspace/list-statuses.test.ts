import { describe, expect, mock, test } from "bun:test";
import { createHandler } from "./list-statuses";

const sampleStatuses = [
  {
    id: "as-1",
    project_id: "proj-1",
    name: "wip",
    color: "blue",
    sort_order: 1,
    is_default: true,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
  {
    id: "as-2",
    project_id: "proj-1",
    name: "blocked",
    color: "red",
    sort_order: 2,
    is_default: false,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
];

const baseDeps = {
  cwd: () => "/repo",
  resolveProjectId: () => ({ projectId: "proj-1", root: "/repo" as string | null }),
  listAttemptStatuses: mock(async () => sampleStatuses),
  log: mock(),
};

describe("workspaces list-statuses", () => {
  test("lists attempt statuses as a table", async () => {
    const log = mock();
    const listAttemptStatuses = mock(async () => sampleStatuses);
    const handler = createHandler({ ...baseDeps, listAttemptStatuses, log });

    await handler({ _: [], $0: "" } as never);

    expect(listAttemptStatuses).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toContain("Name");
    expect(log.mock.calls[0]?.[0]).toContain("wip");
    expect(log.mock.calls[0]?.[0]).toContain("blocked");
  });

  test("prints JSON when --json is used", async () => {
    const log = mock();
    const listAttemptStatuses = mock(async () => sampleStatuses);
    const handler = createHandler({ ...baseDeps, listAttemptStatuses, log });

    await handler({ json: true, _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith(JSON.stringify(sampleStatuses, null, 2));
  });

  test("prints empty message when no attempt statuses are defined", async () => {
    const log = mock();
    const listAttemptStatuses = mock(async () => []);
    const handler = createHandler({ ...baseDeps, listAttemptStatuses, log });

    await handler({ _: [], $0: "" } as never);

    expect(log).toHaveBeenCalledWith("No attempt statuses found.");
  });
});
