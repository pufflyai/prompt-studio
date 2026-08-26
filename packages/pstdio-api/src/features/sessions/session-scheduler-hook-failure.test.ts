import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionScheduler } from "./session-scheduler";

const FAKE_ID = testHarnessId("fake");

const pendingSession = (): HarnessSession => ({
  agentSessionId: `agent-${crypto.randomUUID()}`,
  done: new Promise<HarnessExit>(() => {}),
  stop: () => {},
});

const startSession = mock((_ctx: unknown, _input: unknown) => pendingSession());

afterEach(() => {
  startSession.mockClear();
});

describe("session scheduler pre-start hook failures", () => {
  test("fails the created session without deadlocking the scheduler", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-scheduler-hook-failure-test-"));
    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage"),
      harnessRegistry: createTestHarnessRegistry([
        createTestHarnessRecord("fake", {
          provider: { start: startSession, resume: () => pendingSession(), getMessages: () => [] },
        }),
      ]),
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
          agentId: FAKE_ID,
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
