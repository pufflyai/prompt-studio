import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessExit, QuestionResponse } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("answers a live provider question without replacing or stopping its run", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-live-question-"));
  const answers: QuestionResponse[] = [];
  let stopped = false;
  const finished = Promise.withResolvers<HarnessExit>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("live-question", {
      provider: {
        start: (_ctx, input) => {
          input.events.push({
            op: "add",
            path: "/messages/0",
            value: {
              id: "question-message",
              role: "assistant",
              parts: [
                {
                  type: "tool",
                  tool: "question",
                  callId: "request-1",
                  status: "pending",
                  state: { input: { questions: [{ id: "greeting", question: "Which greeting?", options: [] }] } },
                },
              ],
            },
          });
          return {
            agentSessionId: "live-thread",
            done: finished.promise,
            stop: () => {
              stopped = true;
            },
            replyQuestion: async (response: QuestionResponse) => {
              answers.push(response);
            },
          };
        },
        resume: () => {
          throw new Error("A live reply must not resume a new run");
        },
        getMessages: () => [],
      },
    }),
  ]);
  const handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(root, "storage"),
    harnessRegistry: registry,
  });
  let sessionId: string | undefined;
  try {
    const project = await (
      await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Live question" })),
      })
    ).json();
    const created = await handle.app.request("/v1/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        title: "Ask first",
        prompt: "Ask first",
        agent: testHarnessId("live-question"),
      }),
    });
    expect(created.status).toBe(201);
    const session = await created.json();
    sessionId = session.id;
    for (let attempt = 0; !handle.deps.sessionService.store.get(session.id)?.session && attempt < 50; attempt++)
      await Bun.sleep(10);
    const owner = handle.deps.sessionService.store.get(session.id);
    expect(owner?.session).toBeDefined();
    const before = await handle.deps.sessionService.get(session.id);
    const response = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Hi",
        model: "next-model",
        question_response: { callId: "request-1", answers: [["Hi"]] },
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ follow_up: { status: "dispatched" } });
    expect(answers).toEqual([{ callId: "request-1", answers: [["Hi"]] }]);
    expect(stopped).toBe(false);
    expect(handle.deps.sessionService.store.get(session.id)).toBe(owner);
    expect((await handle.deps.sessionService.get(session.id))?.last_request_started).toBe(before?.last_request_started);
    expect((await handle.deps.sessionService.get(session.id))?.last_selected_model).toBe("next-model");
  } finally {
    finished.resolve({ status: "completed" });
    for (let attempt = 0; sessionId && handle.deps.sessionService.store.get(sessionId) && attempt < 50; attempt++)
      await Bun.sleep(10);
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports a rejected live question reply without claiming it was dispatched", async () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-stale-question-"));
  const finished = Promise.withResolvers<HarnessExit>();
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("stale-question", {
      provider: {
        start: () => ({
          agentSessionId: "thread",
          done: finished.promise,
          stop: () => {},
          replyQuestion: async () => {
            throw Object.assign(new Error("Codex question request is no longer pending."), { questionRejected: true });
          },
        }),
        resume: () => {
          throw new Error("Must use the live reply channel");
        },
        getMessages: () => [],
      },
    }),
  ]);
  const handle = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(root, "storage"),
    harnessRegistry: registry,
  });
  let sessionId: string | undefined;
  try {
    const project = await (
      await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Stale question" })),
      })
    ).json();
    const created = await (
      await handle.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Ask",
          prompt: "Ask",
          agent: testHarnessId("stale-question"),
        }),
      })
    ).json();
    sessionId = created.id;
    for (let attempt = 0; !handle.deps.sessionService.store.get(created.id)?.session && attempt < 50; attempt++)
      await Bun.sleep(10);
    const response = await handle.app.request(`/v1/sessions/${created.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Hi", question_response: { callId: "expired", answers: [["Hi"]] } }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Codex question request is no longer pending." });
    expect(await handle.deps.sessionQueueEntriesService.listPending()).toEqual([]);
  } finally {
    finished.resolve({ status: "completed" });
    for (let attempt = 0; sessionId && handle.deps.sessionService.store.get(sessionId) && attempt < 50; attempt++)
      await Bun.sleep(10);
    await handle.close();
    rmSync(root, { recursive: true, force: true });
  }
});

for (const mode of ["gone", "full", "resume", "failure"]) {
  test(`waits for structured reply acceptance through the ${mode} provider path`, async () => {
    const root = mkdtempSync(join(tmpdir(), "pstdio-question-owner-"));
    const accepted = Promise.withResolvers<void>();
    const replies: QuestionResponse[] = [];
    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("question-owner", {
        provider: {
          start: () => ({
            agentSessionId: "native-thread",
            done: Promise.resolve({ status: "completed" as const }),
            stop: () => {},
          }),
          resume: async (_ctx, input) => {
            if (mode === "failure") throw new Error("Harness startup failed");
            if (mode !== "resume")
              throw Object.assign(new Error("Question request is no longer pending."), { questionRejected: true });
            await accepted.promise;
            replies.push(input.questionResponse!);
            return {
              agentSessionId: input.agentSessionId,
              done: Promise.resolve({ status: "completed" as const }),
              stop: () => {},
            };
          },
          getMessages: () => [],
        },
      }),
    ]);
    const handle = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(root, "storage"),
      harnessRegistry: registry,
    });
    let sessionId: string | undefined;
    try {
      const project = await (
        await handle.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Question owner" })),
        })
      ).json();
      const session = await (
        await handle.app.request("/v1/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            project_id: project.id,
            title: "Ask",
            agent: testHarnessId("question-owner"),
            prompt: "Ask",
          }),
        })
      ).json();
      sessionId = session.id;
      for (
        let attempt = 0;
        (await handle.deps.sessionService.get(session.id))?.status !== "completed" && attempt < 50;
        attempt++
      )
        await Bun.sleep(10);
      expect((await handle.deps.sessionService.get(session.id))?.status).toBe("completed");
      expect(handle.deps.sessionService.store.get(session.id)).toBeNull();
      if (mode === "full") {
        await handle.deps.settingsService.update({ max_concurrent_sessions: 1 });
        await handle.deps.sessionService.create({
          project_id: project.id,
          title: "Active reservation",
          agent: testHarnessId("question-owner"),
          cwd: root,
        });
      }
      let responded = false;
      const response = Promise.resolve(
        handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: "Hi", question_response: { callId: "request-1", answers: [["Hi"]] } }),
        }),
      ).then((result) => {
        responded = true;
        return result;
      });
      if (mode === "resume") {
        await Bun.sleep(30);
        expect(responded).toBe(false);
        accepted.resolve();
        expect((await response).status).toBe(200);
        expect(replies).toEqual([{ callId: "request-1", answers: [["Hi"]] }]);
      } else {
        const result = await response;
        expect(result.status).toBe(mode === "failure" ? 500 : 400);
        if (mode !== "failure")
          expect(await result.json()).toEqual({ error: "Question request is no longer pending." });
      }
    } finally {
      accepted.resolve();
      for (let attempt = 0; sessionId && handle.deps.sessionService.store.get(sessionId) && attempt < 50; attempt++)
        await Bun.sleep(10);
      await handle.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}
