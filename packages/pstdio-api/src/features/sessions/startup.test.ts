import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
      sessionsService: {
        listByStatus: async () => {
          const results = [];
          for (const id of sessionIds) {
            const res = await app.request(`/v1/sessions/${id}`);
            results.push(await res.json());
          }
          return results;
        },
        updateStatus: async (id: string, status: string) => {
          const res = await app.request(`/v1/sessions/${id}/status`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status }),
          });
          return await res.json();
        },
      },
      workspaceSessionsService: { getWorkspaceBySessionId: async () => null },
      reposService: {},
      agentRegistry: { get: () => fakeAgent },
      eventBus: { emit: () => {} },
      sessionStore: { get: () => undefined },
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
  test("updates orphaned in_progress session to completed and emits sessions set event", async () => {
    const staleSession = {
      id: "session-completed",
      agent: null,
      agent_session_id: null,
      project_id: null,
    };
    const updatedSession = { ...staleSession, status: "completed" };
    const emitted: unknown[] = [];

    const deps = {
      sessionsService: {
        listByStatus: async () => [staleSession],
        updateStatus: async (id: string, status: string) => {
          expect(id).toBe(staleSession.id);
          expect(status).toBe("completed");
          return updatedSession;
        },
      },
      workspaceSessionsService: { getWorkspaceBySessionId: async () => null },
      reposService: {},
      agentRegistry: { get: () => null },
      eventBus: {
        emit: (...args: unknown[]) => {
          emitted.push(args);
        },
      },
      sessionStore: { get: () => undefined },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(["sessions", "set", updatedSession]);
  });

  test("updates orphaned in_progress session to failed when agent has no messages and emits sessions set event", async () => {
    const staleSession = {
      id: "session-failed",
      agent: "fake",
      agent_session_id: "agent-session-failed",
      project_id: null,
    };
    const updatedSession = { ...staleSession, status: "failed" };
    const emitted: unknown[] = [];

    const deps = {
      sessionsService: {
        listByStatus: async () => [staleSession],
        updateStatus: async (id: string, status: string) => {
          expect(id).toBe(staleSession.id);
          expect(status).toBe("failed");
          return updatedSession;
        },
      },
      workspaceSessionsService: { getWorkspaceBySessionId: async () => null },
      reposService: {},
      agentRegistry: {
        get: () =>
          ({
            getMessages: async () => [],
          }) as { getMessages: (sessionId: string, options?: { cwd?: string }) => Promise<unknown[]> },
      },
      eventBus: {
        emit: (...args: unknown[]) => {
          emitted.push(args);
        },
      },
      sessionStore: { get: () => undefined },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(["sessions", "set", updatedSession]);
  });

  test("updates orphaned in_progress session to failed when agent message lookup throws and emits sessions set event", async () => {
    const staleSession = {
      id: "session-fetch-error",
      agent: "fake",
      agent_session_id: "agent-session-fetch-error",
      project_id: null,
    };
    const updatedSession = { ...staleSession, status: "failed" };
    const emitted: unknown[] = [];

    const deps = {
      sessionsService: {
        listByStatus: async () => [staleSession],
        updateStatus: async (id: string, status: string) => {
          expect(id).toBe(staleSession.id);
          expect(status).toBe("failed");
          return updatedSession;
        },
      },
      workspaceSessionsService: { getWorkspaceBySessionId: async () => null },
      reposService: {},
      agentRegistry: {
        get: () =>
          ({
            getMessages: async () => {
              throw new Error("agent unavailable");
            },
          }) as { getMessages: (sessionId: string, options?: { cwd?: string }) => Promise<unknown[]> },
      },
      eventBus: {
        emit: (...args: unknown[]) => {
          emitted.push(args);
        },
      },
      sessionStore: { get: () => undefined },
      db: {},
    } as unknown as Parameters<typeof resolveOrphanedSessions>[0];

    await resolveOrphanedSessions(deps);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toEqual(["sessions", "set", updatedSession]);
  });
});
