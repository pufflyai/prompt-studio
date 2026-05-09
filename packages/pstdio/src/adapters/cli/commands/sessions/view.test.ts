import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Session } from "@pstdio/sdk/resources";
import type { Arguments } from "yargs";
import { createHandler, type ViewArgs } from "./view";

const argv = (args: Partial<ViewArgs>) => ({ _: [], $0: "", ...args }) as Arguments<ViewArgs>;

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: "s_abc123",
  project_id: "proj-1",
  title: "Test session",
  status: "completed",
  archived: false,
  last_request_started: "2026-03-05T10:00:00Z",
  last_request_ended: "2026-03-05T10:05:32Z",
  agent: "claude-code",
  last_selected_model: null,
  agent_session_id: null,
  session_file_id: null,
  original_session_id: null,
  cwd: null,
  created_at: "2026-03-05T10:00:00Z",
  updated_at: "2026-03-05T10:05:32Z",
  ...overrides,
});

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(msg: string) => void>;
  return {
    getSession: async () => makeSession(),
    ...overrides,
    log,
  };
};

describe("sessions view", () => {
  test("prints session details", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ id: "s_abc123" }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("s_abc123");
    expect(output).toContain("completed");
    expect(output).toContain("claude-code");
    expect(output).toContain("2026-03-05T10:00:00Z");
    expect(output).toContain("2026-03-05T10:05:32Z");
  });

  test("omits Finished when in_progress", async () => {
    const deps = makeDeps({
      getSession: async () => makeSession({ status: "in_progress", last_request_ended: null }),
    });
    const handler = createHandler(deps);

    await handler(argv({ id: "s_abc123" }));

    const output = deps.log.mock.calls[0][0] as string;
    expect(output).toContain("in_progress");
    expect(output).not.toContain("Finished");
  });

  test("throws when session not found", async () => {
    const deps = makeDeps({ getSession: async () => null });
    const handler = createHandler(deps);

    expect(handler(argv({ id: "nonexistent" }))).rejects.toThrow("Session not found: nonexistent");
  });
});
