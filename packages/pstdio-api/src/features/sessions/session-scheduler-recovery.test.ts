import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession, HarnessStartInput } from "pstdio-api-contracts";
import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";

const FAKE_ID = testHarnessId("fake");

const pendingSession = (): HarnessSession => {
  const exit = Promise.withResolvers<HarnessExit>();

  return {
    agentSessionId: `agent-${crypto.randomUUID()}`,
    done: exit.promise,
    stop: () => exit.resolve({ status: "cancelled" }),
  };
};

const startSession = mock((_ctx: HarnessContext, _input: { prompt: string }) => pendingSession());
const resumeSession = mock((_ctx: HarnessContext, _input: { prompt: string }) => pendingSession());

const createRegistry = () =>
  createTestHarnessRegistry([
    createTestHarnessRecord("fake", {
      provider: { start: startSession, resume: resumeSession, getMessages: () => [] },
    }),
  ]);

const createBlockedRegistry = (delayAfterGets: number) => {
  const registry = createRegistry();
  const resolution = Promise.withResolvers<void>();
  let getCount = 0;

  return {
    ...registry,
    get: async (...args: Parameters<typeof registry.get>) => {
      const shouldDelay = getCount >= delayAfterGets;
      getCount += 1;

      if (shouldDelay) {
        await resolution.promise;
      }
      return registry.get(...args);
    },
  };
};

afterEach(() => {
  startSession.mockClear();
  resumeSession.mockClear();
});

describe("session scheduler startup recovery", () => {
  test("recovers direct dispatched start attachments before transcript persistence", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-direct-attachment-recovery-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({
      dbPath,
      storagePath,
      filesRoot: "",
      harnessRegistry: createBlockedRegistry(3),
    });
    let projectId = "";
    let attachmentId = "";

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Direct Attachment Recovery Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();
      projectId = project.id;

      const uploadRes = await firstApp.app.request(`/v1/projects/${project.id}/session-attachments`, {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-file-name": encodeURIComponent("recover-direct.txt"),
        },
        body: "recover direct context",
      });
      expect(uploadRes.status).toBe(201);
      const attachment = (await uploadRes.json()) as { file_id: string };
      attachmentId = attachment.file_id;

      const createRes = await firstApp.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Recovered direct attachment",
          prompt: "recover direct prompt",
          agent: FAKE_ID,
          attachments: [{ file_id: attachment.file_id }],
        }),
      });
      expect(createRes.status).toBe(201);
      expect(startSession).not.toHaveBeenCalled();
    } finally {
      await firstApp.close();
    }

    startSession.mockClear();
    const recoveredApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (startSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(startSession).toHaveBeenCalledTimes(1);
      const [ctx, input] = startSession.mock.calls[0] ?? [];
      expect(ctx?.projectId).toBe(projectId);
      expect((input as HarnessStartInput | undefined)?.attachments?.[0]?.fileId).toBe(attachmentId);
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("dispatches persisted queued runtime work with the original prompt", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-queue-recovery-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });
    let projectId = "";

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Queue Recovery Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();
      projectId = project.id;

      const queued = await firstApp.deps.sessionService.createQueuedWithEntry(
        {
          project_id: project.id,
          title: "Recovered queued session",
          agent: FAKE_ID,
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
    const recoveredApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (startSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(startSession).toHaveBeenCalledTimes(1);
      const [ctx, input] = startSession.mock.calls[0] ?? [];
      expect(ctx?.projectId).toBe(projectId);
      expect(input).toMatchObject({ prompt: "recover this prompt" });
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
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });

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
          agent: FAKE_ID,
          prompt: "recover claimed prompt",
          request_kind: "start",
        },
        { emitStartedHook: false },
      );

      const [entry] = await firstApp.deps.sessionQueueEntriesService.listPendingBySession(queued.id);
      await firstApp.deps.sessionService.claimQueuedForDispatch(queued.id, entry!.queue_position);
      expect(await firstApp.deps.sessionService.get(queued.id)).toMatchObject({ status: "in_progress" });
      expect(await firstApp.deps.sessionQueueEntriesService.listDispatchStarted()).toContainEqual(
        expect.objectContaining({ session_id: queued.id, prompt: "recover claimed prompt" }),
      );
    } finally {
      await firstApp.close();
    }

    startSession.mockClear();
    const recoveredApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });

    try {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        if (startSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(startSession).toHaveBeenCalledTimes(1);
      const [, input] = startSession.mock.calls[0] ?? [];
      expect(input).toMatchObject({ prompt: "recover claimed prompt" });
      expect(await recoveredApp.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("requeues and dispatches pending follow-ups for orphaned active sessions", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-active-followup-recovery-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });
    let sessionId = "";

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Active Follow-up Recovery Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await firstApp.deps.sessionService.create({
        project_id: project.id,
        title: "Recovered active follow-up session",
        agent: FAKE_ID,
        cwd: tempRoot,
      });
      sessionId = active.id;
      await firstApp.deps.sessionService.update(active.id, { agent_session_id: "agent-session-recovered-active" });

      const followUpRes = await firstApp.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "recover active follow-up" }),
      });
      expect(followUpRes.status).toBe(200);
      expect(await firstApp.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toHaveLength(1);
    } finally {
      await firstApp.close();
    }

    const recoveredApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createRegistry() });

    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (resumeSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(resumeSession).toHaveBeenCalledTimes(1);
      const [, input] = resumeSession.mock.calls[0] ?? [];
      expect(input).toMatchObject({ prompt: "recover active follow-up" });
      expect(await recoveredApp.deps.sessionService.get(sessionId)).toMatchObject({ status: "in_progress" });
      expect(await recoveredApp.deps.sessionQueueEntriesService.listPendingBySession(sessionId)).toEqual([]);
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
