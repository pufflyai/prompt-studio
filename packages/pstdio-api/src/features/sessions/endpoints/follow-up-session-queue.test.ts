import { describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, HarnessSession } from "pstdio-api-contracts";
import { createApp } from "../../../app";
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

const resumeSession = mock((_ctx: unknown, _input: unknown) => pendingSession());

const createRegistry = () =>
  createTestHarnessRegistry([
    createTestHarnessRecord("fake", {
      provider: {
        start: mock((_ctx: unknown, _input: unknown) => pendingSession()),
        resume: resumeSession,
        getMessages: () => [],
      },
    }),
  ]);

const waitForResumeCalls = async (count: number) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (resumeSession.mock.calls.length >= count) return;
    await Bun.sleep(25);
  }

  throw new Error(`Timed out waiting for ${count} resume calls`);
};

const resumePrompts = (calls: Array<unknown[]>) =>
  calls.map((call) => (call[1] as { prompt?: string } | undefined)?.prompt);

describe("POST /v1/sessions multi-pending follow-ups", () => {
  test("edits, removes, and reorders pending follow-ups", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-queued-followup-actions-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createRegistry(),
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Queued Follow-Up Actions Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Active queued actions session",
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-session-actions" });

      const responses = await Promise.all(
        ["first", "second", "third"].map((prompt) =>
          isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt }),
          }),
        ),
      );
      const bodies = await Promise.all(responses.map((res) => res.json()));
      const positions = bodies.map((body) => body.follow_up.queue_position as number);

      const editRes = await isolated.app.request(`/v1/sessions/${active.id}/queued-follow-ups/${positions[1]}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "edited second" }),
      });
      expect(editRes.status).toBe(200);

      const moveRes = await isolated.app.request(`/v1/sessions/${active.id}/queued-follow-ups/${positions[2]}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction: "up" }),
      });
      expect(moveRes.status).toBe(200);
      expect(await moveRes.json()).toEqual({ ok: true, queuePosition: positions[1] });

      const deleteRes = await isolated.app.request(`/v1/sessions/${active.id}/queued-follow-ups/${positions[0]}`, {
        method: "DELETE",
      });
      expect(deleteRes.status).toBe(200);

      const pending = await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id);
      expect(pending.map((entry) => entry.prompt)).toEqual(["third", "edited second"]);

      const conversationRes = await isolated.app.request(`/v1/sessions/${active.id}/conversation`);
      expect(conversationRes.status).toBe(200);
      const conversation = await conversationRes.json();
      const queuedText = conversation.messages
        .filter((message: { id?: string }) => message.id?.startsWith(`queued-prompt-${active.id}-`))
        .map(
          (message: { parts: Array<{ type: string; text?: string }> }) =>
            message.parts.find((part) => part.type === "text")?.text,
        );
      expect(queuedText).toEqual(["third", "edited second"]);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  }, 10_000);

  test("queues multiple follow-ups against an active session and dispatches them FIFO", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-multi-pending-followup-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createRegistry(),
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Multi-Pending Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Active session",
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-session-1" });

      const responses = await Promise.all(
        ["first", "second", "third"].map((prompt) =>
          isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
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

      expect((await isolated.deps.sessionService.get(active.id))?.status).toBe("in_progress");

      const pending = await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id);
      expect(pending.map((entry) => entry.prompt)).toEqual(["first", "second", "third"]);

      const callsBefore = resumeSession.mock.calls.length;

      for (let index = 0; index < 3; index += 1) {
        await isolated.deps.sessionService.transitionStatus(active.id, "completed");
        await waitForResumeCalls(callsBefore + index + 1);
      }

      expect(resumePrompts(resumeSession.mock.calls.slice(callsBefore))).toEqual(["first", "second", "third"]);
      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });
});

describe("POST /v1/sessions active follow-up cancellation", () => {
  test("cancelling an active session removes pending follow-ups without dispatching", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-active-cancel-followup-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createRegistry(),
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Active Cancel Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Active cancel session",
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-session-cancel" });

      const followUpRes = await isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "drop me" }),
      });
      expect(followUpRes.status).toBe(200);
      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toHaveLength(1);

      const callsBefore = resumeSession.mock.calls.length;
      await isolated.deps.sessionService.transitionStatus(active.id, "cancelled");
      await Bun.sleep(50);

      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
      expect(resumeSession.mock.calls.length).toBe(callsBefore);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });

  test("cancellation removes a follow-up inserted after cancellation cleanup", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-active-cancel-race-followup-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createRegistry(),
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Active Cancel Race Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Active cancel race session",
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-session-cancel-race" });

      const originalInsert = isolated.deps.sessionService.insertEntryForActive;
      const insertStarted = Promise.withResolvers<void>();
      const allowInsert = Promise.withResolvers<void>();
      isolated.deps.sessionService.insertEntryForActive = async (input) => {
        insertStarted.resolve();
        await allowInsert.promise;
        return originalInsert(input);
      };

      const followUp = isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "race drop me" }),
      });
      await insertStarted.promise;

      const callsBefore = resumeSession.mock.calls.length;
      const cancel = isolated.deps.sessionService.transitionStatus(active.id, "cancelled");
      await Bun.sleep(25);
      allowInsert.resolve();

      expect((await followUp).status).toBe(200);
      await cancel;

      expect(await isolated.deps.sessionService.get(active.id)).toMatchObject({ status: "cancelled" });
      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
      expect(resumeSession.mock.calls.length).toBe(callsBefore);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });
});

describe("POST /v1/sessions follow-up terminal races", () => {
  test("dispatches a pending active follow-up when insert happens before terminal transition", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-insert-first-followup-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createRegistry(),
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Insert First Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Insert first session",
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-session-insert-first" });

      const followUpRes = await isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "insert before terminal" }),
      });
      expect(followUpRes.status).toBe(200);

      const callsBefore = resumeSession.mock.calls.length;
      await isolated.deps.sessionService.transitionStatus(active.id, "completed");
      await waitForResumeCalls(callsBefore + 1);

      expect(resumePrompts(resumeSession.mock.calls.slice(callsBefore))).toEqual(["insert before terminal"]);
      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });

  test("dispatches a follow-up posted after terminal transition without leaving pending work", async () => {
    const isolatedTempRoot = mkdtempSync(join(tmpdir(), "pstdio-api-terminal-first-followup-test-"));
    const isolated = await createApp({
      dbPath: ":memory:",
      storagePath: join(isolatedTempRoot, "storage"),
      filesRoot: "",
      harnessRegistry: createRegistry(),
    });

    try {
      const projectRes = await isolated.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Terminal First Project" }),
      });
      expect(projectRes.status).toBe(201);
      const project = await projectRes.json();

      const active = await isolated.deps.sessionService.create({
        project_id: project.id,
        title: "Terminal first session",
        agent: FAKE_ID,
        cwd: isolatedTempRoot,
      });
      await isolated.deps.sessionService.update(active.id, { agent_session_id: "agent-session-terminal-first" });
      await isolated.deps.sessionService.transitionStatus(active.id, "completed");

      const callsBefore = resumeSession.mock.calls.length;
      const followUpRes = await isolated.app.request(`/v1/sessions/${active.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "terminal before insert" }),
      });
      expect(followUpRes.status).toBe(200);
      await waitForResumeCalls(callsBefore + 1);

      expect(resumePrompts(resumeSession.mock.calls.slice(callsBefore))).toEqual(["terminal before insert"]);
      expect(await isolated.deps.sessionQueueEntriesService.listPendingBySession(active.id)).toEqual([]);
    } finally {
      await isolated.close();
      rmSync(isolatedTempRoot, { recursive: true, force: true });
    }
  });
});
