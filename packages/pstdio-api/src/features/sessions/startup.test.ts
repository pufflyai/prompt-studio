import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { HarnessEventSink, HarnessSession, SessionMessage } from "pstdio-api-contracts";
import { createEventStore } from "pstdio-api-runtime-host";
import { createSessionService } from "../../services/session-service";
import { createTestApp } from "../../test-utils/create-test-app";
import type { AppBindings } from "../../types";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { resolveOrphanedSessions } from "./startup";

const FAKE_ID = testHarnessId("fake");
const OPENCODE_ID = testHarnessId("opencode");

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;

// Mirrors the canonical fake harness: pushes a user + assistant message then completes shortly after.
const createFakeProvider = () => {
  const sessions = new Map<string, SessionMessage[]>();

  const message = (agentSessionId: string, index: number, role: SessionMessage["role"], text: string) => ({
    id: `${agentSessionId}-msg-${index}`,
    role,
    parts: [{ type: "text" as const, text }],
  });

  const pushMessages = (events: HarnessEventSink, startIndex: number, messages: SessionMessage[]) => {
    for (const [offset, value] of messages.entries()) {
      events.push({ op: "add", path: `/messages/${startIndex + offset}`, value });
    }
  };

  const session = (agentSessionId: string): HarnessSession => ({
    agentSessionId,
    done: new Promise((resolve) => setTimeout(() => resolve({ status: "completed" }), 50)),
    stop: () => {},
  });

  return {
    start: (_ctx: unknown, input: { prompt: string; events: HarnessEventSink }) => {
      const agentSessionId = `fake-${crypto.randomUUID()}`;
      const messages = [
        message(agentSessionId, 0, "user", input.prompt),
        message(agentSessionId, 1, "assistant", `Fake Agent: completed "${input.prompt}"`),
      ];
      sessions.set(agentSessionId, messages);
      pushMessages(input.events, 0, messages);
      return session(agentSessionId);
    },
    resume: (_ctx: unknown, input: { prompt: string; agentSessionId: string; events: HarnessEventSink }) => {
      const existing = sessions.get(input.agentSessionId) ?? [];
      const startIndex = existing.length;
      const messages = [
        message(input.agentSessionId, startIndex, "user", input.prompt),
        message(input.agentSessionId, startIndex + 1, "assistant", `Fake Agent: follow-up "${input.prompt}"`),
      ];
      sessions.set(input.agentSessionId, [...existing, ...messages]);
      pushMessages(input.events, startIndex, messages);
      return session(input.agentSessionId);
    },
    getMessages: (_ctx: unknown, input: { agentSessionId: string }) => sessions.get(input.agentSessionId) ?? [],
  };
};

const waitForSessionStatus = async (sessionId: string, expectedStatus: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    const body = await res.json();
    if (body.status === expectedStatus) return body;
    await Bun.sleep(50);
  }
  throw new Error(`Session ${sessionId} did not reach status ${expectedStatus}`);
};

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-startup-test-"));

  ({ app, close } = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("fake", { provider: createFakeProvider() })]),
  }));
});

afterAll(async () => {
  await close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("resolveOrphanedSessions (via createApp startup)", () => {
  test("stream sends raw DB status without lazy fix", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Startup Sweep Project" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Will become stale",
        prompt: "hello",
        agent: FAKE_ID,
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(session.id, "completed");

    // Force back to in_progress (simulates server restart losing the session handle)
    await app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });

    // Without the lazy fix, the stream sends the raw DB status
    const streamRes = await app.request(`/v1/sessions/${session.id}/stream`);
    const body = await streamRes.text();
    expect(body).toContain('"status":"in_progress"');
  });

  test("completed sessions are not affected", async () => {
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Completed Session Project" }),
    });
    const project = await projectRes.json();

    const createRes = await app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Already completed",
        prompt: "hello",
        agent: FAKE_ID,
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(session.id, "completed");

    const res = await app.request(`/v1/sessions/${session.id}`);
    expect((await res.json()).status).toBe("completed");
  });
});

describe("resolveOrphanedSessions abort", () => {
  test("stops resolving sessions when signal is aborted", async () => {
    // Create a project and multiple stale sessions
    const projectRes = await app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Abort Test Project" }),
    });
    const project = await projectRes.json();

    const sessionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const createRes = await app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: `stale-${i}`,
          prompt: "hello",
          agent: FAKE_ID,
        }),
      });
      const session = await createRes.json();
      await waitForSessionStatus(session.id, "completed");

      // Force back to in_progress
      await app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
      sessionIds.push(session.id);
    }

    // Abort immediately
    const controller = new AbortController();
    controller.abort();

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("fake")]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionQueueEntriesService: {
        listDispatchStarted: async () => [],
        remove: async () => {},
      },
      sessionService: {
        store: { get: () => undefined },
        listByStatus: async () => {
          const results = [];
          for (const id of sessionIds) {
            const res = await app.request(`/v1/sessions/${id}`);
            results.push(await res.json());
          }
          return results;
        },
        transitionStatus: async (id: string, status: string) => {
          const res = await app.request(`/v1/sessions/${id}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status }),
          });
          return await res.json();
        },
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps, controller.signal);

    // All sessions should still be in_progress (none resolved)
    for (const id of sessionIds) {
      const res = await app.request(`/v1/sessions/${id}`);
      const body = await res.json();
      expect(body.status).toBe("in_progress");
    }
  });
});

describe("resolveOrphanedSessions resolution", () => {
  test("transitions orphaned session to disconnected", async () => {
    const staleSession = {
      id: "session-hooked",
      agent: null,
      agent_session_id: null,
      project_id: "project-1",
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionQueueEntriesService: {
        listDispatchStarted: async () => [],
        remove: async () => {},
      },
      sessionService: {
        store: { get: () => undefined },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(transitionStatus).toHaveBeenCalledWith(staleSession.id, "disconnected");
  });

  test("message lookup success does not imply completed", async () => {
    const staleSession = {
      id: "session-with-messages",
      agent: FAKE_ID,
      agent_session_id: "agent-session-with-messages",
      project_id: null,
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("fake", {
          provider: {
            getMessages: () => [
              { id: "m1", role: "assistant", parts: [{ type: "text", text: "hello" }] } as SessionMessage,
            ],
          },
        }),
      ]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionService: {
        store: { get: () => undefined },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(transitionStatus).toHaveBeenCalledWith(staleSession.id, "disconnected");
  });

  test("reattaches orphan when agent advertises SessionReattach", async () => {
    const staleSession = {
      id: "session-reattach",
      agent: OPENCODE_ID,
      agent_session_id: "oc-xyz",
      cwd: "/work",
      project_id: "p1",
    };
    const reattach = mock(
      (_ctx: unknown, _input: unknown): HarnessSession => ({
        agentSessionId: "oc-xyz",
        done: new Promise(() => {}),
        stop: () => {},
        timeoutStrategy: "provider",
      }),
    );
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));
    const storeCreate = mock(() => ({
      eventStore: createEventStore(),
      approvalService: { handleResponse: () => {}, dispose: () => {} },
    }));

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("opencode", {
          provider: {
            capabilities: () => ["SessionReattach"],
            reattach,
          },
        }),
      ]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionQueueEntriesService: {
        listDispatchStarted: async () => [],
        remove: async () => {},
      },
      sessionService: {
        store: {
          get: () => undefined,
          create: storeCreate,
          setSession: () => {},
          remove: () => {},
        },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(reattach).toHaveBeenCalledTimes(1);
    expect(reattach).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sessionId: "session-reattach", agentSessionId: "oc-xyz", cwd: "/work" }),
    );
    expect(transitionStatus).not.toHaveBeenCalled();
  });

  test("falls back to disconnected when reattach throws", async () => {
    const staleSession = {
      id: "session-reattach-fail",
      agent: OPENCODE_ID,
      agent_session_id: "oc-err",
      cwd: "/work",
      project_id: "p1",
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));
    const storeCreate = mock(() => ({
      eventStore: createEventStore(),
      approvalService: { handleResponse: () => {}, dispose: () => {} },
    }));

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("opencode", {
          provider: {
            capabilities: () => ["SessionReattach"],
            reattach: () => {
              throw new Error("opencode unreachable");
            },
          },
        }),
      ]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionQueueEntriesService: {
        listDispatchStarted: async () => [],
        remove: async () => {},
      },
      sessionService: {
        store: {
          get: () => undefined,
          create: storeCreate,
          setSession: () => {},
          remove: () => {},
        },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(transitionStatus).toHaveBeenCalledWith(staleSession.id, "disconnected");
  });

  test("message lookup failure does not imply failed", async () => {
    const staleSession = {
      id: "session-fetch-error",
      agent: FAKE_ID,
      agent_session_id: "agent-session-fetch-error",
      project_id: null,
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("fake", {
          provider: {
            getMessages: () => {
              throw new Error("agent unavailable");
            },
          },
        }),
      ]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionService: {
        store: { get: () => undefined },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(transitionStatus).toHaveBeenCalledWith(staleSession.id, "disconnected");
  });
});

describe("resolveOrphanedSessions hooks", () => {
  // PS-63 regression: the orphan-recovery startup sweep is a secondary
  // status-transition path. It must fire onSessionStatusChanged so any hook
  // listening for `in_progress -> disconnected` (post-session-fail style
  // automation) runs — exactly the gap PS-59 + this ticket close.
  test("fires onSessionStatusChanged when transitioning an orphan to disconnected", async () => {
    const staleSession = {
      id: "session-orphan-hook",
      agent: null,
      agent_session_id: null,
      project_id: "project-orphan",
      status: "in_progress",
      original_session_id: null,
    };
    const updateStatus = mock(async (id: string, status: string) => ({ ...staleSession, id, status }));
    const sessionsDb = {
      get: mock(async () => null),
      list: mock(async () => []),
      listByStatus: mock(async () => [staleSession]),
      updateStatus,
      create: mock(async () => null),
      update: mock(async () => null),
      archive: mock(async () => null),
      cancelQueued: mock(async () => null),
      archiveQueued: mock(async () => null),
    } as unknown as Parameters<typeof createSessionService>[0]["sessionsDb"];

    const onSessionStatusChanged = mock(() => {});
    const sessionService = createSessionService({
      sessionsDb,
      eventBus: { emit: () => {} } as unknown as Parameters<typeof createSessionService>[0]["eventBus"],
      onSessionStatusChanged,
    });

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([]),
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionService,
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(updateStatus).toHaveBeenCalledWith("session-orphan-hook", "disconnected");
    expect(onSessionStatusChanged).toHaveBeenCalledWith({
      id: "session-orphan-hook",
      project_id: "project-orphan",
      status: "disconnected",
      original_session_id: null,
    });
  });
});

describe("resolveOrphanedSessions readiness gate", () => {
  test("refuses to reattach an orphan whose workspace failed to provision", async () => {
    const staleSession = {
      id: "session-unready",
      agent: OPENCODE_ID,
      agent_session_id: "oc-unready",
      cwd: "/work",
      project_id: "p1",
    };
    const reattach = mock(
      (_ctx: unknown, _input: unknown): HarnessSession => ({
        agentSessionId: "oc-unready",
        done: new Promise(() => {}),
        stop: () => {},
        timeoutStrategy: "provider",
      }),
    );
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));
    const storeCreate = mock(() => ({
      eventStore: createEventStore(),
      approvalService: { handleResponse: () => {}, dispose: () => {} },
    }));

    const deps = {
      repoService: {},
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("opencode", {
          provider: { capabilities: () => ["SessionReattach"], reattach },
        }),
      ]),
      eventBus: { emit: () => {} },
      // A failed provision must block reattach on startup too, not boot the harness into the
      // half-synced skill tree — the same gate every other entrypoint enforces.
      workspaceSessionService: {
        getWorkspaceBySessionId: async () => ({ id: "w1", initializing: false, setup_error: "skill sync failed" }),
      },
      sessionQueueEntriesService: { listDispatchStarted: async () => [], remove: async () => {} },
      sessionService: {
        store: { get: () => undefined, create: storeCreate, setSession: () => {}, remove: () => {} },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(reattach).not.toHaveBeenCalled();
    expect(transitionStatus).toHaveBeenCalledWith("session-unready", "disconnected");
  });
});
