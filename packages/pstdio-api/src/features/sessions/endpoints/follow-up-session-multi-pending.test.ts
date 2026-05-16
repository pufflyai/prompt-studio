import { describe, expect, mock, test } from "bun:test";
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
const resumeSession = mock(async () => ({}));

const agent = {
  id: "fake",
  name: "Fake Agent",
  capabilities: () => [],
  checkAvailability: () => ({ type: "INSTALLED" }),
  listModels: () => [],
  startSession,
  resumeSession,
  getMessages: async () => [],
  listSessions: async () => [],
  exportSession: async () => ({ session: { id: "agent-session", title: "Session" }, messages: [] }),
  launchSession: async () => ({}),
} as unknown as AgentService;

const waitForResumeCalls = async (count: number) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (resumeSession.mock.calls.length >= count) return;
    await Bun.sleep(25);
  }

  throw new Error(`Timed out waiting for ${count} resume calls`);
};

const createIsolatedApp = async () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-multi-pending-test-"));
  const app = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [agent],
  });
  return { app, tempRoot };
};

const cleanup = async (handle: Awaited<ReturnType<typeof createIsolatedApp>>) => {
  await handle.app.close();
  rmSync(handle.tempRoot, { recursive: true, force: true });
};

const createProject = async (handle: Awaited<ReturnType<typeof createIsolatedApp>>, name: string) => {
  const res = await handle.app.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(res.status).toBe(201);
  return res.json();
};

const createActive = async (
  handle: Awaited<ReturnType<typeof createIsolatedApp>>,
  projectId: string,
  agentSessionId: string,
) => {
  const session = await handle.app.deps.sessionService.create({
    project_id: projectId,
    title: "Active session",
    agent: "fake",
    cwd: handle.tempRoot,
  });
  await handle.app.deps.sessionService.update(session.id, { agent_session_id: agentSessionId });
  return session;
};

describe("POST /v1/sessions multi-pending follow-ups", () => {
  test("queues multiple follow-ups against an active session and dispatches them FIFO", async () => {
    const handle = await createIsolatedApp();

    try {
      const project = await createProject(handle, "Multi-Pending Project");
      const active = await createActive(handle, project.id, "agent-session-multi");

      const responses = await Promise.all(
        ["first", "second", "third"].map((prompt) =>
          handle.app.app.request(`/v1/sessions/${active.id}/follow-up`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
          }),
        ),
      );

      expect(responses.map((res) => res.status)).toEqual([200, 200, 200]);
      const bodies = await Promise.all(responses.map((res) => res.json()));
      expect(bodies.map((b) => b.follow_up.status)).toEqual(["queued", "queued", "queued"]);
      const positions = bodies.map((b) => b.follow_up.queue_position as number);
      expect(positions[0]).toBeLessThan(positions[1]);
      expect(positions[1]).toBeLessThan(positions[2]);

      expect((await handle.app.deps.sessionService.get(active.id))?.status).toBe("in_progress");
      const pending = await handle.app.deps.sessionQueueEntriesService.listPendingBySession(active.id);
      expect(pending.map((entry) => entry.prompt)).toEqual(["first", "second", "third"]);

      const callsBefore = resumeSession.mock.calls.length;
      for (let index = 0; index < 3; index += 1) {
        await handle.app.deps.sessionService.transitionStatus(active.id, "completed");
        await waitForResumeCalls(callsBefore + index + 1);
      }

      const followUpCalls = resumeSession.mock.calls.slice(callsBefore) as unknown as Array<[Record<string, unknown>]>;
      expect(followUpCalls.map((call) => call[0]?.prompt)).toEqual(["first", "second", "third"]);
      expect(await handle.app.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await cleanup(handle);
    }
  });
});

describe("POST /v1/sessions active follow-up cancellation", () => {
  test("cancelling an active session drops pending follow-ups without dispatching", async () => {
    const handle = await createIsolatedApp();

    try {
      const project = await createProject(handle, "Active Cancel Project");
      const active = await createActive(handle, project.id, "agent-session-cancel");

      const followUpRes = await handle.app.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "drop me" }),
      });
      expect(followUpRes.status).toBe(200);
      expect(await handle.app.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toHaveLength(1);

      const callsBefore = resumeSession.mock.calls.length;
      await handle.app.deps.sessionService.transitionStatus(active.id, "cancelled");
      await Bun.sleep(50);

      expect(await handle.app.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
      expect(resumeSession.mock.calls.length).toBe(callsBefore);
    } finally {
      await cleanup(handle);
    }
  });
});

describe("POST /v1/sessions follow-up terminal races", () => {
  test("dispatches a pending active follow-up when insert happens before terminal transition", async () => {
    const handle = await createIsolatedApp();

    try {
      const project = await createProject(handle, "Insert First Project");
      const active = await createActive(handle, project.id, "agent-session-insert-first");

      const followUpRes = await handle.app.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "insert before terminal" }),
      });
      expect(followUpRes.status).toBe(200);

      const callsBefore = resumeSession.mock.calls.length;
      await handle.app.deps.sessionService.transitionStatus(active.id, "completed");
      await waitForResumeCalls(callsBefore + 1);

      const followUpCalls = resumeSession.mock.calls.slice(callsBefore) as unknown as Array<[Record<string, unknown>]>;
      expect(followUpCalls[0]?.[0]).toMatchObject({ prompt: "insert before terminal" });
      expect(await handle.app.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await cleanup(handle);
    }
  });

  test("dispatches a follow-up posted after terminal transition without leaving pending work", async () => {
    const handle = await createIsolatedApp();

    try {
      const project = await createProject(handle, "Terminal First Project");
      const active = await createActive(handle, project.id, "agent-session-terminal-first");
      await handle.app.deps.sessionService.transitionStatus(active.id, "completed");

      const callsBefore = resumeSession.mock.calls.length;
      const followUpRes = await handle.app.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "terminal before insert" }),
      });
      expect(followUpRes.status).toBe(200);
      await waitForResumeCalls(callsBefore + 1);

      const followUpCalls = resumeSession.mock.calls.slice(callsBefore) as unknown as Array<[Record<string, unknown>]>;
      expect(followUpCalls[0]?.[0]).toMatchObject({ prompt: "terminal before insert" });
      expect(await handle.app.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await cleanup(handle);
    }
  });
});
