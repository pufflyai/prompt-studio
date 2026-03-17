import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type StopArgs } from "./stop";

const argv = (args: Partial<StopArgs>) => ({ _: [], $0: "", ...args }) as Arguments<StopArgs>;

const makeSession = (overrides = {}) => ({
  id: "s_abc123",
  project_id: "proj-1",
  title: "Test",
  status: "in_progress",
  archived: false,
  created: "2026-03-05T10:00:00Z",
  last_request_started: "2026-03-05T10:00:00Z",
  last_request_ended: null,
  agent: "claude-code",
  agent_session_id: null,
  created_at: "2026-03-05T10:00:00Z",
  updated_at: "2026-03-05T10:00:00Z",
  ...overrides,
});

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    getSession: async () => makeSession(),
    updateSessionStatus: mock(async () => ({ id: "s_abc123", status: "cancelled" })),
    ...overrides,
    log,
  };
};

describe("sessions stop", () => {
  test("stops a running session", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "s_abc123" }));

    expect(deps.updateSessionStatus).toHaveBeenCalledWith(expect.any(String), "s_abc123", "cancelled");
    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("Stopped session s_abc123");
  });

  test("throws when session not found", async () => {
    const deps = makeDeps({ getSession: async () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ id: "nonexistent" }))).rejects.toThrow("Session not found: nonexistent");
  });

  test("throws when session is not running", async () => {
    const deps = makeDeps({ getSession: async () => makeSession({ status: "completed" }) });
    const handler = createHandler(deps);

    expect(handler(argv({ id: "s_abc123" }))).rejects.toThrow("Session is not running");
  });
});
