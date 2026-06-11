import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import { createApp } from "../../../app";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

const FAKE_ID = testHarnessId("fake");

const pendingSession = (): HarnessSession => ({
  agentSessionId: `agent-${crypto.randomUUID()}`,
  done: new Promise<HarnessExit>(() => {}),
  stop: () => {},
});

const startSession = mock((_ctx: unknown, _input: unknown) => pendingSession());

const createRegistry = () =>
  createTestHarnessRegistry([
    createTestHarnessRecord("fake", {
      provider: { start: startSession, resume: () => pendingSession(), getMessages: () => [] },
    }),
  ]);

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
      harnessRegistry: createRegistry(),
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
        body: JSON.stringify({ project_id: project.id, title: "Active", prompt: "active", agent: FAKE_ID }),
      });
      const queuedRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Queued", prompt: "queued", agent: FAKE_ID }),
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
      harnessRegistry: createRegistry(),
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
        body: JSON.stringify({ project_id: project.id, title: "Active", prompt: "active", agent: FAKE_ID }),
      });
      const queuedResponses = await Promise.all(
        ["Queued One", "Queued Two"].map((title) =>
          isolated.app.request("/v1/sessions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ project_id: project.id, title, prompt: title, agent: FAKE_ID }),
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
