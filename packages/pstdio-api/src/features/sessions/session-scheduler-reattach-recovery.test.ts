import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import type { HarnessContext } from "pstdio-api-contracts/extension-kernel";
import { createApp } from "../../app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";

const OPENCODE_ID = testHarnessId("opencode");

const pendingSession = (agentSessionId: string): HarnessSession => {
  const exit = Promise.withResolvers<HarnessExit>();

  return {
    agentSessionId,
    done: exit.promise,
    stop: () => exit.resolve({ status: "cancelled" }),
    timeoutStrategy: "provider",
  };
};

const startSession = mock((_ctx: HarnessContext, _input: { prompt: string }) => pendingSession("replayed-start"));
const resumeSession = mock((_ctx: HarnessContext, _input: { prompt: string }) => pendingSession("replayed-resume"));
const reattachSession = mock((_ctx: HarnessContext, input: { agentSessionId: string }) =>
  pendingSession(input.agentSessionId),
);
const failedReattachSession = mock(() => {
  throw new Error("reattach failed");
});

const createReattachRegistry = (options?: { reattachFails?: boolean }) =>
  createTestHarnessRegistry([
    createTestHarnessRecord("opencode", {
      provider: {
        capabilities: () => ["SessionReattach"],
        reattach: options?.reattachFails ? failedReattachSession : reattachSession,
        resume: resumeSession,
        start: startSession,
      },
    }),
  ]);

afterEach(() => {
  failedReattachSession.mockClear();
  reattachSession.mockClear();
  resumeSession.mockClear();
  startSession.mockClear();
});

describe("session scheduler reattach recovery", () => {
  test("reattaches an active attachment session instead of replaying its dispatch-started row", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-reattach-attachment-recovery-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createReattachRegistry() });
    let sessionId = "";

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Reattach Attachment Recovery Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = (await projectRes.json()) as { id: string };

      const uploadRes = await firstApp.app.request(`/v1/projects/${project.id}/session-attachments`, {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-file-name": encodeURIComponent("reattach-existing.txt"),
        },
        body: "reattach existing context",
      });
      expect(uploadRes.status).toBe(201);
      const attachment = (await uploadRes.json()) as { file_id: string };

      const session = await firstApp.deps.sessionService.create({
        project_id: project.id,
        title: "Existing provider session",
        agent: OPENCODE_ID,
        cwd: tempRoot,
      });
      sessionId = session.id;
      await firstApp.deps.sessionService.update(session.id, { agent_session_id: "opencode-existing-session" });
      await firstApp.deps.sessionQueueEntriesService.createDispatchStarted({
        session_id: session.id,
        prompt: "do not replay this prompt",
        request_kind: "start",
        attachments_json: [{ file_id: attachment.file_id }],
      });
      expect(await firstApp.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
    } finally {
      await firstApp.close();
    }

    const recoveredApp = await createApp({
      dbPath,
      storagePath,
      filesRoot: "",
      harnessRegistry: createReattachRegistry(),
    });

    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (reattachSession.mock.calls.length > 0 || startSession.mock.calls.length > 0) break;
        await Bun.sleep(25);
      }

      expect(reattachSession).toHaveBeenCalledTimes(1);
      expect(startSession).not.toHaveBeenCalled();
      expect(resumeSession).not.toHaveBeenCalled();
      expect(await recoveredApp.deps.sessionService.get(sessionId)).toMatchObject({ status: "in_progress" });
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test("cleans dispatch-started attachment rows when reattach fails", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-reattach-failure-cleanup-test-"));
    const dbPath = join(tempRoot, "db");
    const storagePath = join(tempRoot, "storage");
    const firstApp = await createApp({ dbPath, storagePath, filesRoot: "", harnessRegistry: createReattachRegistry() });
    let projectId = "";
    let sessionId = "";
    let fileId = "";

    try {
      const projectRes = await firstApp.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Failed Reattach Attachment Cleanup Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = (await projectRes.json()) as { id: string };
      projectId = project.id;

      const uploadRes = await firstApp.app.request(`/v1/projects/${project.id}/session-attachments`, {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-file-name": encodeURIComponent("reattach-failure.txt"),
        },
        body: "reattach failure context",
      });
      expect(uploadRes.status).toBe(201);
      const attachment = (await uploadRes.json()) as { file_id: string };
      fileId = attachment.file_id;

      const session = await firstApp.deps.sessionService.create({
        project_id: project.id,
        title: "Failed provider reattach",
        agent: OPENCODE_ID,
        cwd: tempRoot,
      });
      sessionId = session.id;
      await firstApp.deps.sessionService.update(session.id, { agent_session_id: "opencode-failed-reattach" });
      await firstApp.deps.sessionQueueEntriesService.createDispatchStarted({
        session_id: session.id,
        prompt: "cleanup this failed reattach marker",
        request_kind: "start",
        attachments_json: [{ file_id: attachment.file_id }],
      });
      expect(await firstApp.deps.sessionQueueEntriesService.listDispatchStarted()).toHaveLength(1);
    } finally {
      await firstApp.close();
    }

    const recoveredApp = await createApp({
      dbPath,
      storagePath,
      filesRoot: "",
      harnessRegistry: createReattachRegistry({ reattachFails: true }),
    });

    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const session = await recoveredApp.deps.sessionService.get(sessionId);
        if (session?.status === "disconnected") break;
        await Bun.sleep(25);
      }

      expect(failedReattachSession).toHaveBeenCalledTimes(1);
      expect(await recoveredApp.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);

      const deleteRes = await recoveredApp.app.request(`/v1/projects/${projectId}/session-attachments/${fileId}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(204);
    } finally {
      await recoveredApp.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
