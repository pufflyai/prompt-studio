import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { AgentService } from "pstdio-agents";
import { createApp } from "../../app";
import { createSessionScheduler } from "./session-scheduler";

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

describe("session scheduler pre-start hook failures", () => {
  test("fails the created session without deadlocking the scheduler", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-scheduler-hook-failure-test-"));
    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
      agents: [agent],
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Scheduler Hook Failure Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();
      const scheduler = createSessionScheduler(handle.deps);

      await expect(
        scheduler.createAndStartSession({
          projectId: project.id,
          title: "Hook failure",
          agentId: "fake",
          prompt: "fail before start",
          onBeforeStartedHook: async () => {
            throw new Error("link failed");
          },
        }),
      ).rejects.toThrow("link failed");

      expect(await handle.deps.sessionService.listByStatus("failed")).toHaveLength(1);

      const drained = await Promise.race([
        scheduler.drainQueue().then(() => "drained"),
        Bun.sleep(1_000).then(() => null),
      ]);

      expect(drained).toBe("drained");
      expect(startSession).not.toHaveBeenCalled();
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
