import { expect, test } from "bun:test";
import type { HarnessExit } from "pstdio-api-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("stale structured answers leave ordinary active and queued runs owned", async () => {
  const finished = Promise.withResolvers<HarnessExit>();
  let stops = 0;
  let resumes = 0;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("ordinary-run", {
      provider: {
        start: () => ({
          agentSessionId: "ordinary-thread",
          done: finished.promise,
          stop: () => {
            stops++;
          },
        }),
        resume: () => {
          resumes++;
          return {
            agentSessionId: "ordinary-thread",
            done: finished.promise,
            stop: () => {
              stops++;
            },
          };
        },
        getMessages: () => [],
      },
    }),
  ]);
  const handle = await createTestApp({ harnessRegistry: registry });
  const sessionIds: string[] = [];
  try {
    await handle.deps.settingsService.update({ max_concurrent_sessions: 1 });
    const project = await (
      await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Ordinary runs" })),
      })
    ).json();
    for (const status of ["in_progress", "queued"] as const) {
      const created = await handle.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Work",
          prompt: "Work",
          agent: testHarnessId("ordinary-run"),
        }),
      });
      expect(created.status).toBe(201);
      const session = await created.json();
      sessionIds.push(session.id);
      expect(session.status).toBe(status);
      if (status === "in_progress")
        for (let attempt = 0; !handle.deps.sessionService.store.get(session.id)?.session && attempt < 50; attempt++)
          await Bun.sleep(10);
      const owner = handle.deps.sessionService.store.get(session.id);
      const started = (await handle.deps.sessionService.get(session.id))?.last_request_started;
      const reply = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Blue", question_response: { callId: "old-question", answers: [["Blue"]] } }),
      });
      expect(reply.status).toBe(400);
      expect((await handle.deps.sessionService.get(session.id))?.status).toBe(status);
      expect((await handle.deps.sessionService.get(session.id))?.last_request_started).toBe(started);
      expect(handle.deps.sessionService.store.get(session.id)).toBe(owner);
      expect(stops).toBe(0);
      expect(resumes).toBe(0);
    }
  } finally {
    finished.resolve({ status: "completed" });
    for (let attempt = 0; attempt < 50; attempt++) {
      const sessions = await Promise.all(sessionIds.map((id) => handle.deps.sessionService.get(id)));
      if (
        sessions.every((session) => session?.status === "completed") &&
        sessionIds.every((id) => !handle.deps.sessionService.store.get(id))
      )
        break;
      await Bun.sleep(10);
    }
    await handle.close();
  }
});

test("waits for the active provider owner before resuming a question without a live channel", async () => {
  const finished = Promise.withResolvers<HarnessExit>();
  let stops = 0;
  let resumes = 0;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("recover-question", {
      provider: {
        start: (_ctx, input) => {
          input.events.push({
            op: "add",
            path: "/messages/0",
            value: {
              id: "question-message",
              role: "assistant",
              parts: [{ type: "tool", tool: "question", callId: "pending-question", status: "pending" }],
            },
          });
          return {
            agentSessionId: "question-thread",
            done: finished.promise,
            stop: () => {
              stops++;
            },
          };
        },
        resume: (_ctx, input) => {
          resumes++;
          expect(input.questionResponse).toEqual({ callId: "pending-question", answers: [["Blue"]] });
          return {
            agentSessionId: "question-thread",
            done: Promise.resolve({ status: "completed" as const }),
            stop: () => {},
          };
        },
        getMessages: () => [],
      },
    }),
  ]);
  const handle = await createTestApp({ harnessRegistry: registry });
  let sessionId: string | undefined;
  let response: Promise<Response> | undefined;
  try {
    const project = await (
      await handle.app.request("/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(folderProjectInput({ name: "Recover question" })),
      })
    ).json();
    const session = await (
      await handle.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Ask",
          prompt: "Ask",
          agent: testHarnessId("recover-question"),
        }),
      })
    ).json();
    sessionId = session.id;
    for (let attempt = 0; !handle.deps.sessionService.store.get(session.id)?.session && attempt < 50; attempt++)
      await Bun.sleep(10);
    const owner = handle.deps.sessionService.store.get(session.id);
    let responded = false;
    response = Promise.resolve(
      handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: "Blue",
          question_response: { callId: "pending-question", answers: [["Blue"]] },
        }),
      }),
    ).then((result) => {
      responded = true;
      return result;
    });
    await Bun.sleep(30);
    expect(responded).toBe(false);
    expect(stops).toBe(0);
    expect(resumes).toBe(0);
    expect(handle.deps.sessionService.store.get(session.id)).toBe(owner);
    finished.resolve({ status: "completed" });
    expect((await response).status).toBe(200);
    expect(resumes).toBe(1);
  } finally {
    finished.resolve({ status: "completed" });
    await response;
    for (let attempt = 0; sessionId && handle.deps.sessionService.store.get(sessionId) && attempt < 50; attempt++)
      await Bun.sleep(10);
    await handle.close();
  }
});
