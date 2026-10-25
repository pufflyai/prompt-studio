import { describe, expect, type Mock, mock, test } from "bun:test";
import type { Arguments } from "yargs";
import { createHandler, type ResolveSessionIdArgs } from "./resolve-session-id";

const argv = (args: Partial<ResolveSessionIdArgs>) =>
  ({ _: [], $0: "", json: false, ...args }) as Arguments<ResolveSessionIdArgs>;

const makeDeps = (overrides: Partial<Parameters<typeof createHandler>[0]> = {}) => {
  const log = (overrides.log ?? mock()) as Mock<(message: string) => void>;
  return {
    resolveSessionId: mock(async () => ({ session_id: "sess-123" as string | null })),
    ...overrides,
    log,
  };
};

describe("sessions resolve-session-id", () => {
  test("prints JSON when --json is used", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ agent: "opencode", "agent-session-id": "oc-1", cwd: "/repo/a", json: true }));

    expect(deps.resolveSessionId).toHaveBeenCalledWith({
      agent: "opencode",
      agent_session_id: "oc-1",
      cwd: "/repo/a",
    });
    expect(deps.log).toHaveBeenCalledWith(
      JSON.stringify(
        {
          session_id: "sess-123",
        },
        null,
        2,
      ),
    );
  });

  test("prints the resolved session id by default", async () => {
    const deps = makeDeps();
    const handler = createHandler(deps);

    await handler(argv({ agent: "opencode", "agent-session-id": "oc-2" }));

    expect(deps.log).toHaveBeenCalledWith("sess-123");
  });

  test("prints no-match message when mapping does not exist", async () => {
    const deps = makeDeps({ resolveSessionId: mock(async () => ({ session_id: null })) });
    const handler = createHandler(deps);

    await handler(argv({ agent: "opencode", "agent-session-id": "oc-3" }));

    expect(deps.log).toHaveBeenCalledWith("No matching session found.");
  });
});
