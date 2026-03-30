import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type UpdateWhenAttemptStatusArgs } from "./update-when-attempt-status";

const argv = (args: Partial<UpdateWhenAttemptStatusArgs>) =>
  ({ _: [], $0: "", ...args }) as Arguments<UpdateWhenAttemptStatusArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    cwd: () => "/fake/dir",
    resolveProjectId: () => ({ projectId: "proj_1", root: "/fake/dir" }),
    resolveTicketByShorthand: mock(async () => ({ id: "ticket_1", shorthand: "PS-1" })) as never,
    updateWhenAttemptStatus: mock(async () => ({ updated: true })),
    ...overrides,
    log,
  };
};

describe("tickets update-when-attempt-status", () => {
  test("updates ticket when condition is met", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "PS-1", "all-attempts-status": "reviewed", "set-status": "review" }));

    expect(deps.updateWhenAttemptStatus).toHaveBeenCalledWith(expect.any(String), "ticket_1", {
      all_attempts_status: "reviewed",
      set_status: "review",
    });
    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("updated");
  });

  test("reports no-op when condition is not met", async () => {
    const deps = makeDeps({
      updateWhenAttemptStatus: mock(async () => ({ updated: false })),
    });
    const handler = createHandler(deps);

    await handler(argv({ id: "PS-1", "all-attempts-status": "reviewed", "set-status": "review" }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("not all");
  });

  test("throws when ticket not found", async () => {
    const deps = makeDeps({
      resolveTicketByShorthand: mock(async () => null) as never,
    });
    const handler = createHandler(deps);

    expect(handler(argv({ id: "PS-999", "all-attempts-status": "reviewed", "set-status": "review" }))).rejects.toThrow(
      "Ticket not found",
    );
  });
});
