import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
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

let handle: Awaited<ReturnType<typeof createApp>>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-create-session-queue-test-"));
  handle = await createApp({
    dbPath: ":memory:",
    storagePath: join(tempRoot, "storage"),
    filesRoot: "",
    agents: [agent],
  });
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("POST /v1/sessions queueing", () => {
  test("queues a second session when global concurrency is full", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Queue Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const otherProjectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Other Queue Project" }),
    });
    expect(otherProjectRes.status).toBe(201);
    const otherProject = await otherProjectRes.json();

    const settingsRes = await handle.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: 1 }),
    });
    expect(settingsRes.status).toBe(200);

    const firstRes = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: project.id, title: "First", prompt: "first", agent: "fake" }),
    });
    expect(firstRes.status).toBe(201);
    const first = await firstRes.json();
    expect(first.status).toBe("in_progress");

    const secondRes = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: otherProject.id, title: "Second", prompt: "second", agent: "fake" }),
    });
    expect(secondRes.status).toBe(201);
    const second = await secondRes.json();
    expect(second.status).toBe("queued");
    expect(second.last_request_started).toBeNull();

    expect(startSession).toHaveBeenCalledTimes(1);

    const queuedRes = await handle.app.request(`/v1/sessions?project_id=${otherProject.id}&status=queued`);
    expect(queuedRes.status).toBe(200);
    expect(await queuedRes.json()).toEqual([expect.objectContaining({ id: second.id, status: "queued" })]);

    const entries = await handle.deps.sessionQueueEntriesService.listPending();
    expect(entries).toEqual([
      expect.objectContaining({ session_id: second.id, prompt: "second", request_kind: "start" }),
    ]);
  });

  test("generic session transitions cannot create queue-less queued sessions", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Generic Queue Reject Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Generic Queue Reject",
      agent: "fake",
    });

    await expect(handle.deps.sessionService.transitionStatus(session.id, "queued")).rejects.toThrow(
      "Queued status is scheduler-owned",
    );
  });

  test("cancelling a queued session removes the pending queue entry", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Cancel Queued Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const queued = await handle.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Cancel queued",
        agent: "fake",
        prompt: "queued prompt",
        request_kind: "start",
      },
      { emitStartedHook: false },
    );

    const cancelRes = await handle.app.request(`/v1/sessions/${queued.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    expect(cancelRes.status).toBe(200);
    expect(await cancelRes.json()).toMatchObject({ id: queued.id, status: "cancelled" });

    const entries = await handle.deps.sessionQueueEntriesService.listPending();
    expect(entries.some((entry) => entry.session_id === queued.id)).toBe(false);
  });
});
