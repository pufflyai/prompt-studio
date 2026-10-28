import { afterEach, describe, expect, mock, test } from "bun:test";
import { createHandler } from "./run";

const originalConsoleLog = console.log;

afterEach(() => {
  console.log = originalConsoleLog;
});

describe("automation run command", () => {
  test("passes parsed command input and the idempotency key to the SDK", async () => {
    const createRun = mock(async () => ({ id: "run-1", status: "queued" }));
    console.log = mock(() => {}) as typeof console.log;
    const handler = createHandler({ createRun } as never);

    await handler({
      project: "project-1",
      command: "pstdio.planner.command.start-attempt",
      idempotencyKey: "notion-page-123-revision-7",
      input: '{"params":{"ticketId":"PS-294"}}',
    } as never);

    expect(createRun).toHaveBeenCalledWith("project-1", "notion-page-123-revision-7", {
      commandId: "pstdio.planner.command.start-attempt",
      input: { params: { ticketId: "PS-294" } },
    });
  });
});
