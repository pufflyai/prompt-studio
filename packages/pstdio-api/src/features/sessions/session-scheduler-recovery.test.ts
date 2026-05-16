import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { AgentService } from "pstdio-agents";
import { createApp } from "../../app";

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

describe("session scheduler startup recovery", () => {
  test("dispatches persisted queued runtime work with the original prompt", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-queue-recovery-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", agents: [agent] });

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Queue Recovery Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const queued = await firstApp.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: "Recovered queued session",
          agent: "fake",
          prompt: "recover this prompt",
          request_kind: "start",
        },
        { emitStartedHook: false },
      );

      expect(queued.status).toBe("queued");
      expect(await firstApp.deps.sessionQueueEntriesService.listPending()).toHaveLength(1);
    } finally {
      await firstApp.close();
    }

    startSession.mockClear();
    const recoveredApp = await createApp({ dbPath, storagePath, filesRoot: "", agents: [agent] });

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (startSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(startSession).toHaveBeenCalledTimes(1);
      const calls = startSession.mock.calls as unknown as Array<[Record<string, unknown>]>;
      expect(calls[0]?.[0]).toMatchObject({ prompt: "recover this prompt" });
      expect(await recoveredApp.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("recovers a queued entry claimed before dispatch was initiated", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-claimed-queue-recovery-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", agents: [agent] });

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Claimed Queue Recovery Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const queued = await firstApp.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: "Claimed recovered queued session",
          agent: "fake",
          prompt: "recover claimed prompt",
          request_kind: "start",
        },
        { emitStartedHook: false },
      );

      await firstApp.deps.sessionService.claimQueuedForDispatch(queued.id);
      expect(await firstApp.deps.sessionService.get(queued.id)).toMatchObject({ status: "in_progress" });
      expect(await firstApp.deps.sessionQueueEntriesService.listDispatchStarted()).toContainEqual(
        expect.objectContaining({ session_id: queued.id, prompt: "recover claimed prompt" }),
      );
    } finally {
      await firstApp.close();
    }

    startSession.mockClear();
    const recoveredApp = await createApp({ dbPath, storagePath, filesRoot: "", agents: [agent] });

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (startSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(startSession).toHaveBeenCalledTimes(1);
      const calls = startSession.mock.calls as unknown as Array<[Record<string, unknown>]>;
      expect(calls[0]?.[0]).toMatchObject({ prompt: "recover claimed prompt" });
      expect(await recoveredApp.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
