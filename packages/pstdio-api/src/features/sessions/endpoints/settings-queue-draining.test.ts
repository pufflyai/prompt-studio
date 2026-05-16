import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { AgentService } from "pstdio-agents";
import { createApp } from "../../../app";

const startSession = mock(async () => ({
  sessionId: `agent-${crypto.randomUUID()}`,
  process: {
    stdin: new PassThrough(),
    kill: () => {},
    onExit: new Promise<{ code: number | null; signal: string | null }>(() => {}),
  },
}));

const agent = {
  id: "fake",
  name: "Fake Agent",
  capabilities: () => [],
  checkAvailability: () => ({ type: "INSTALLED" }),
  listModels: () => [],
  startSession,
  resumeSession: async () => ({}),
  getMessages: async () => [],
  listSessions: async () => [],
  exportSession: async () => ({ session: { id: "agent-session", title: "Session" }, messages: [] }),
  launchSession: async () => ({}),
} as unknown as AgentService;

afterEach(() => {
  startSession.mockClear();
});

describe("PATCH /v1/settings queue draining", () => {
  test("starts queued sessions when the concurrency setting is raised", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-settings-drain-queue-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
      agents: [agent],
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Settings Drain Queue Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });

      await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Active", prompt: "active", agent: "fake" }),
      });
      const queuedRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Queued", prompt: "queued", agent: "fake" }),
      });
      const queued = await queuedRes.json();
      expect(queued.status).toBe("queued");
      expect(startSession).toHaveBeenCalledTimes(1);

      const settingsRes = await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 2 }),
      });
      expect(settingsRes.status).toBe(200);

      expect(await isolated.deps.sessionService.get(queued.id)).toMatchObject({ id: queued.id, status: "in_progress" });
      expect(startSession).toHaveBeenCalledTimes(2);
      expect(await isolated.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      await isolated.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("drains all queued sessions when concurrency becomes unlimited", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-settings-unlimited-drain-queue-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
      agents: [agent],
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Unlimited Settings Drain Queue Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });

      await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Active", prompt: "active", agent: "fake" }),
      });
      const queuedResponses = await Promise.all(
        ["Queued One", "Queued Two"].map((title) =>
          isolated.app.request("/v1/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ project_id: project.id, title, prompt: title, agent: "fake" }),
          }),
        ),
      );
      const queuedSessions = await Promise.all(queuedResponses.map((response) => response.json()));
      expect(queuedSessions.map((session) => session.status)).toEqual(["queued", "queued"]);
      expect(startSession).toHaveBeenCalledTimes(1);

      const settingsRes = await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: null }),
      });
      expect(settingsRes.status).toBe(200);

      const drained = await Promise.all(queuedSessions.map((session) => isolated.deps.sessionService.get(session.id)));
      expect(drained.map((session) => session?.status)).toEqual(["in_progress", "in_progress"]);
      expect(startSession).toHaveBeenCalledTimes(3);
      expect(await isolated.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      await isolated.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
