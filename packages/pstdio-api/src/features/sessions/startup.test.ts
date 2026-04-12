import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { createFakeAgent } from "pstdio-agents";
import { createApp } from "../../app";
import type { AppBindings } from "../../types";
import { resolveOrphanedSessions } from "./startup";

let app: OpenAPIHono<AppBindings>;
let close: () => Promise<void>;
let tempRoot: string;

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
  const fakeAgent = createFakeAgent();

  ({ app, close } = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [fakeAgent],
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
        agent: "fake",
      }),
    });
    const session = await createRes.json();
    await waitForSessionStatus(session.id, "completed");

    // Force back to in_progress (simulates server restart losing the process handle)
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
        agent: "fake",
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
          agent: "fake",
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

    const fakeAgent = createFakeAgent();
    const deps = {
      repoService: {},
      agentRegistry: { get: () => fakeAgent },
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
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
      agentRegistry: { get: () => null },
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

  test("message lookup success does not imply completed", async () => {
    const staleSession = {
      id: "session-with-messages",
      agent: "fake",
      agent_session_id: "agent-session-with-messages",
      project_id: null,
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));

    const deps = {
      repoService: {},
      agentRegistry: {
        get: () =>
          ({
            getMessages: async () => [{ role: "assistant", content: "hello" }],
          }) as { getMessages: (sessionId: string, options?: { cwd?: string }) => Promise<unknown[]> },
      },
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
      agent: "opencode",
      agent_session_id: "oc-xyz",
      cwd: "/work",
      project_id: "p1",
    };
    const reattachSession = mock(async () => ({
      process: {
        sessionId: "oc-xyz",
        stdin: { write: () => {}, end: () => {} } as unknown,
        kill: () => {},
        onExit: new Promise(() => {}),
        timeoutStrategy: "provider" as const,
      },
    }));
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));
    const storeCreate = mock(() => ({
      eventStore: {
        push: () => {},
        subscribe: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true }) }) }),
      },
    }));

    const deps = {
      repoService: {},
      agentRegistry: {
        get: () => ({
          reattachSession,
          capabilities: () => ["SessionReattach"],
        }),
      },
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionService: {
        store: {
          get: () => undefined,
          create: storeCreate,
          setProcess: () => {},
          remove: () => {},
        },
        listByStatus: async () => [staleSession],
        transitionStatus,
      },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(reattachSession).toHaveBeenCalledTimes(1);
    expect(reattachSession).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "oc-xyz", cwd: "/work" }),
      expect.anything(),
    );
    expect(transitionStatus).not.toHaveBeenCalled();
  });

  test("falls back to disconnected when reattach throws", async () => {
    const staleSession = {
      id: "session-reattach-fail",
      agent: "opencode",
      agent_session_id: "oc-err",
      cwd: "/work",
      project_id: "p1",
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));
    const storeCreate = mock(() => ({
      eventStore: {
        push: () => {},
        subscribe: () => ({ [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true }) }) }),
      },
    }));

    const deps = {
      repoService: {},
      agentRegistry: {
        get: () => ({
          reattachSession: async () => {
            throw new Error("opencode unreachable");
          },
          capabilities: () => ["SessionReattach"],
        }),
      },
      eventBus: { emit: () => {} },
      workspaceSessionService: { getWorkspaceBySessionId: async () => null },
      sessionService: {
        store: {
          get: () => undefined,
          create: storeCreate,
          setProcess: () => {},
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
      agent: "fake",
      agent_session_id: "agent-session-fetch-error",
      project_id: null,
    };
    const transitionStatus = mock(async () => ({ ...staleSession, status: "disconnected" }));

    const deps = {
      repoService: {},
      agentRegistry: {
        get: () =>
          ({
            getMessages: async () => {
              throw new Error("agent unavailable");
            },
          }) as { getMessages: (sessionId: string, options?: { cwd?: string }) => Promise<unknown[]> },
      },
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
