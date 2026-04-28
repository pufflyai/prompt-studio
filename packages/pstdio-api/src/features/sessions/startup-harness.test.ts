import { describe, expect, mock, test } from "bun:test";
import { resolveOrphanedSessions } from "./startup";

describe("resolveOrphanedSessions harness identities", () => {
  test("normalizes harness id before provider registry lookup and reattach", async () => {
    const staleSession = {
      id: "session-reattach-harness",
      agent: "pstdio.harness.opencode",
      agent_session_id: "oc-xyz",
      cwd: "/work",
      project_id: "p1",
    };
    const reattachSession = mock(async (_input: unknown, _eventStore: unknown) => ({
      process: {
        sessionId: "oc-xyz",
        stdin: { write: () => {}, end: () => {} } as unknown,
        kill: () => {},
        onExit: new Promise(() => {}),
        timeoutStrategy: "provider" as const,
      },
    }));
    const resolve = mock(async () => ({
      provider: {
        reattachSession: (_ctx: unknown, input: unknown, eventStore: unknown) => reattachSession(input, eventStore),
      },
      context: {},
    }));
    const storeCreate = mock(() => ({
      eventStore: {
        push: () => {},
        subscribe: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true }) }) }),
      },
    }));

    const deps = {
      harnessProviderService: { resolve },
      eventBus: { emit: () => {} },
      sessionService: {
        store: {
          get: () => undefined,
          create: storeCreate,
          setProcess: () => {},
          remove: () => {},
        },
        listByStatus: async () => [staleSession],
        transitionStatus: mock(async () => ({ ...staleSession, status: "disconnected" })),
      },
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith("pstdio.harness.opencode", "p1");
    expect(reattachSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "oc-xyz", cwd: "/work" }),
      expect.anything(),
    );
  });
});
