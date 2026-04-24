import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { AgentService } from "pstdio-agents";
import { createApp } from "../../../app";

const createCancellableAgent = (
  kill: ReturnType<typeof mock>,
  onExit: Promise<{ code: number | null; signal: string | null }>,
) =>
  ({
    id: "fake",
    name: "Cancellable Agent",
    capabilities: () => [],
    checkAvailability: () => ({ type: "INSTALLED" }),
    listModels: () => [],
    startSession: async () => ({
      sessionId: "agent-session-1",
      process: {
        sessionId: "agent-session-1",
        stdin: new PassThrough(),
        kill,
        onExit,
      },
    }),
    resumeSession: async () => ({}),
    getMessages: async () => [],
    listSessions: async () => [],
    exportSession: async () => ({ session: { id: "agent-session-1", title: "Session" }, messages: [] }),
    launchSession: async () => ({}),
  }) as unknown as AgentService;

const waitForCall = async (fn: ReturnType<typeof mock>) => {
  for (let index = 0; index < 20; index += 1) {
    if (fn.mock.calls.length > 0) return;
    await Bun.sleep(10);
  }

  throw new Error("Timed out waiting for call");
};

const waitForAgentSessionId = async (app: Awaited<ReturnType<typeof createApp>>["app"], sessionId: string) => {
  for (let index = 0; index < 20; index += 1) {
    const res = await app.request(`/v1/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    const session = await res.json();
    if (session.agent_session_id === "agent-session-1") return;
    await Bun.sleep(10);
  }

  throw new Error("Timed out waiting for agent session id");
};

const waitForSessionStoreRemoval = (
  sessionService: Awaited<ReturnType<typeof createApp>>["deps"]["sessionService"],
  sessionId: string,
) => {
  const { promise, resolve } = Promise.withResolvers<void>();
  const originalRemove = sessionService.store.remove;

  sessionService.store.remove = (removedSessionId: string) => {
    originalRemove(removedSessionId);
    if (removedSessionId === sessionId) {
      resolve();
    }
  };

  if (!sessionService.store.get(sessionId)) {
    resolve();
  }

  return Promise.race([
    promise,
    Bun.sleep(500).then(() => {
      throw new Error("Timed out waiting for session store cleanup");
    }),
  ]);
};

describe("PATCH /v1/sessions/:id/status", () => {
  test("cancelled kills the active process and does not get overwritten on process exit", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-update-session-status-test-"));
    const { promise: onExit, resolve: resolveExit } = Promise.withResolvers<{
      code: number | null;
      signal: string | null;
    }>();
    const kill = mock(() => {});
    const handle = await createApp({
      dbPath: ":memory:",
      storagePath: join(tempRoot, "storage"),
      filesRoot: "",
      agents: [createCancellableAgent(kill, onExit)],
    });

    try {
      const projectRes = await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Cancel Session Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const createRes = await handle.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Cancel me",
          prompt: "keep running",
          agent: "fake",
        }),
      });
      expect(createRes.status).toBe(201);
      const session = await createRes.json();
      await waitForAgentSessionId(handle.app, session.id);

      const cancelRes = await handle.app.request(`/v1/sessions/${session.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      expect(cancelRes.status).toBe(200);
      expect(await cancelRes.json()).toMatchObject({ id: session.id, status: "cancelled" });

      await waitForCall(kill);
      const storeRemoved = waitForSessionStoreRemoval(handle.deps.sessionService, session.id);
      resolveExit({ code: 0, signal: null });
      await storeRemoved;

      const finalRes = await handle.app.request(`/v1/sessions/${session.id}`);
      expect(finalRes.status).toBe(200);
      expect(await finalRes.json()).toMatchObject({ id: session.id, status: "cancelled" });
    } finally {
      await handle.close();
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
