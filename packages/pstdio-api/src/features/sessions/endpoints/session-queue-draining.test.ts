import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
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
const resumeSession = mock((_ctx: unknown, _input: unknown) => pendingSession());

const createRegistry = () =>
  createTestHarnessRegistry([
    createTestHarnessRecord("fake", {
      provider: { start: startSession, resume: resumeSession, getMessages: () => [] },
    }),
  ]);

let handle: Awaited<ReturnType<typeof createTestApp>>;
let tempRoot: string;

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-session-queue-draining-test-"));
  handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(tempRoot, "storage"),
    harnessRegistry: createRegistry(),
  });
});

afterAll(async () => {
  await handle.close();
  rmSync(tempRoot, { recursive: true, force: true });
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
      agent: FAKE_ID,
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
      agent: FAKE_ID,
      cwd: tempRoot,
    });

    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Follow-up will queue",
      agent: FAKE_ID,
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

  test("queues additional follow-ups when the session is already queued", async () => {
    const projectRes = await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Multi-Pending Queued Project" }),
    });
    expect(projectRes.status).toBe(201);
    const project = await projectRes.json();

    const queued = await handle.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Already queued",
        agent: FAKE_ID,
        cwd: tempRoot,
        prompt: "first queued prompt",
        request_kind: "follow_up",
      },
      { emitStartedHook: false },
    );

    const followUpRes = await handle.app.request(`/v1/sessions/${queued.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "second queued prompt" }),
    });
    expect(followUpRes.status).toBe(200);
    const body = await followUpRes.json();
    expect(body.follow_up.status).toBe("queued");

    const entries = await handle.deps.sessionQueueEntriesService.listPendingBySession(queued.id);
    expect(entries.map((entry) => entry.prompt)).toEqual(["first queued prompt", "second queued prompt"]);
  });
});

describe("POST /v1/sessions isolated queue draining", () => {
  test("serializes concurrent follow-ups against the global concurrency limit", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-concurrent-followup-queue-test-"));
    const isolated = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(isolatedTempRoot, "storage"),
      harnessRegistry: createRegistry(),
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
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      const second = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Second concurrent follow-up",
        agent: FAKE_ID,
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
    const isolated = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(isolatedTempRoot, "storage"),
      harnessRegistry: createRegistry(),
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
        body: JSON.stringify({ project_id: project.id, title: "First", prompt: "first", agent: FAKE_ID }),
      });
      expect(firstRes.status).toBe(201);
      const first = await firstRes.json();

      const secondRes = await isolated.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: project.id, title: "Second", prompt: "second", agent: FAKE_ID }),
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
