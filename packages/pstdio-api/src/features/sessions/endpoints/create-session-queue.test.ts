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

describe("POST /v1/sessions queue draining", () => {
  test("resumes question responses for awaiting input sessions without queueing", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Question Response Queue Bypass Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    await handle.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: 1 }),
    });

    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Awaiting input capacity holder",
      agent: "fake",
      cwd: tempRoot,
    });
    await handle.deps.sessionService.update(session.id, { agent_session_id: "agent-session-awaiting-input" });
    await handle.deps.sessionService.transitionStatus(session.id, "awaiting_input");
    resumeSession.mockClear();

    const followUpRes = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "answer", question_response: { answers: [["yes"]] } }),
    });

    expect(followUpRes.status).toBe(200);
    expect(await followUpRes.json()).toMatchObject({ id: session.id, status: "in_progress" });
    expect(resumeSession).toHaveBeenCalledTimes(1);
    expect(await handle.deps.sessionQueueEntriesService.listPending()).not.toContainEqual(
      expect.objectContaining({ session_id: session.id }),
    );
  });

  test("queues a follow-up when global concurrency is full", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Follow-up Queue Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const settingsRes = await handle.app.request("/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ max_concurrent_sessions: 1 }),
    });
    expect(settingsRes.status).toBe(200);

    await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Active capacity holder",
      agent: "fake",
      cwd: tempRoot,
    });

    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Follow-up will queue",
      agent: "fake",
      cwd: tempRoot,
    });
    await handle.deps.sessionService.transitionStatus(session.id, "completed");

    const followUpRes = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "queued follow-up" }),
    });
    expect(followUpRes.status).toBe(200);
    expect(await followUpRes.json()).toMatchObject({ id: session.id, status: "queued" });

    const entries = await handle.deps.sessionQueueEntriesService.listPending();
    expect(entries).toContainEqual(
      expect.objectContaining({ session_id: session.id, prompt: "queued follow-up", request_kind: "follow_up" }),
    );
  });

  test("rejects follow-up when the session is already queued", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Queued Follow-up Reject Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const queued = await handle.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Already queued",
        agent: "fake",
        cwd: tempRoot,
        prompt: "first queued prompt",
        request_kind: "follow_up",
      },
      { emitStartedHook: false },
    );

    const followUpRes = await handle.app.request(`/v1/sessions/${queued.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "duplicate follow-up" }),
    });
    expect(followUpRes.status).toBe(409);
  });

  test("serializes concurrent follow-ups against the global concurrency limit", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-concurrent-followup-queue-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      agents: [agent],
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Concurrent Follow-up Queue Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const settingsRes = await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });
      expect(settingsRes.status).toBe(200);

      const first = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "First concurrent follow-up",
        agent: "fake",
        cwd: isolatedTempRoot,
      });
      const second = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Second concurrent follow-up",
        agent: "fake",
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.transitionStatus(first.id, "completed");
      await isolated.deps.sessionService.transitionStatus(second.id, "completed");

      const responses = await Promise.all(
        [first, second].map((session, index) =>
          isolated.app.request(`/v1/sessions/${session.id}/follow-up`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt: `concurrent follow-up ${index + 1}` }),
          }),
        ),
      );

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      expect(bodies.map((body) => body.status).sort()).toEqual(["in_progress", "queued"]);

      const entries = await isolated.deps.sessionQueueEntriesService.listPending();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.request_kind).toBe("follow_up");
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });

  test("starts the next queued session when capacity opens", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-drain-session-queue-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      agents: [agent],
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Drain Queue Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const settingsRes = await isolated.app.request("/v1/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ max_concurrent_sessions: 1 }),
      });
      expect(settingsRes.status).toBe(200);

      const startedBefore = startSession.mock.calls.length;
      const firstRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "First", prompt: "first", agent: "fake" }),
      });
      expect(firstRes.status).toBe(201);
      const first = await firstRes.json();

      const secondRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Second", prompt: "second", agent: "fake" }),
      });
      expect(secondRes.status).toBe(201);
      const second = await secondRes.json();
      expect(second.status).toBe("queued");
      expect(startSession.mock.calls.length).toBe(startedBefore + 1);

      await isolated.deps.sessionService.transitionStatus(first.id, "completed");

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const session = await isolated.deps.sessionService.get(second.id);
        if (session?.status === "in_progress") break;
        await Bun.sleep(25);
      }

      expect(await isolated.deps.sessionService.get(second.id)).toMatchObject({ id: second.id, status: "in_progress" });
      expect(startSession.mock.calls.length).toBe(startedBefore + 2);
      expect(await isolated.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });
});
