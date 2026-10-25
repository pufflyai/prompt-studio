import { afterEach, describe, expect, test } from "bun:test";
import type { HarnessExit, HarnessSession, HarnessStartInput, QuestionResponse } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { ANSWER_WITH_FILES_ERROR } from "./live-question-reply";

const ASKING_ID = testHarnessId("asking");

// A harness that asks one question on its first turn and finishes with the answer.
const createAskingProvider = () => {
  const state = {
    answer: null as QuestionResponse | null,
    askError: null as unknown,
    resumeCalls: 0,
  };

  const start = (_ctx: unknown, input: HarnessStartInput): HarnessSession => {
    const done = Promise.withResolvers<HarnessExit>();

    void input.questions
      ?.ask({
        id: "ask-1",
        toolUseId: "toolu_1",
        questions: [{ question: "Red or blue?", options: [{ label: "Red" }, { label: "Blue" }] }],
      })
      .then(
        (answer) => {
          state.answer = answer;
          done.resolve({ status: "completed" });
        },
        (error) => {
          state.askError = error;
        },
      );

    return {
      agentSessionId: "agent-asking",
      done: done.promise,
      stop: () => done.resolve({ status: "cancelled" }),
      timeoutStrategy: "provider",
    };
  };

  const resume = (): HarnessSession => {
    state.resumeCalls += 1;
    return { agentSessionId: "agent-asking", done: Promise.resolve({ status: "completed" }), stop: () => {} };
  };

  return { state, provider: { start, resume, getMessages: () => [] } };
};

const openApp = async () => {
  const asking = createAskingProvider();
  const handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("asking", { provider: asking.provider })]),
  });
  return { ...handle, asking };
};

let close: (() => Promise<void>) | null = null;
afterEach(async () => {
  await close?.();
  close = null;
});

const startAskingSession = async (app: Awaited<ReturnType<typeof openApp>>["app"]) => {
  const projectRes = await app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Questions" })),
  });
  const project = await projectRes.json();

  const createRes = await app.request("/v1/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      project_id: project.id,
      title: "Asks a question",
      prompt: "pick a colour",
      agent: ASKING_ID,
    }),
  });
  return await createRes.json();
};

const waitForStatus = async (app: Awaited<ReturnType<typeof openApp>>["app"], id: string, expected: string) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const res = await app.request(`/v1/sessions/${id}`);
    const body = await res.json();
    if (body.status === expected) return body;
    await Bun.sleep(25);
  }
  throw new Error(`Session ${id} did not reach status ${expected}`);
};

describe("harness questions", () => {
  test("an open question makes the session wait for the person", async () => {
    const handle = await openApp();
    close = handle.close;

    const session = await startAskingSession(handle.app);

    await waitForStatus(handle.app, session.id, "awaiting_input");
    expect(handle.deps.sessionService.store.get(session.id)?.questionService.hasPending()).toBe(true);
  });

  test("a follow-up answers the open question in the same run", async () => {
    const handle = await openApp();
    close = handle.close;

    const session = await startAskingSession(handle.app);
    await waitForStatus(handle.app, session.id, "awaiting_input");

    const followUp = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Blue" }),
    });
    expect(followUp.status).toBe(200);
    expect(await followUp.json()).toMatchObject({ follow_up: { status: "dispatched" } });

    await waitForStatus(handle.app, session.id, "completed");
    expect(handle.asking.state.answer).toEqual({ answers: [["Blue"]] });
    expect(handle.asking.state.resumeCalls).toBe(0);

    const queued = await handle.app.request(`/v1/sessions/${session.id}/queued-messages`);
    expect(await queued.json()).toMatchObject({
      messages: [],
      queue: { requests: [], steeringAvailable: false },
    });
  });

  test("an answer cannot carry files, so the question stays open instead of losing them", async () => {
    const handle = await openApp();
    close = handle.close;

    const session = await startAskingSession(handle.app);
    await waitForStatus(handle.app, session.id, "awaiting_input");
    const upload = await handle.app.request(`/v1/projects/${session.project_id}/session-attachments`, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-file-name": "notes.txt" },
      body: "notes",
    });
    const attachment = await upload.json();

    const followUp = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Blue", attachments: [{ file_id: attachment.file_id }] }),
    });

    expect(followUp.status).toBe(400);
    expect(await followUp.json()).toEqual({ error: ANSWER_WITH_FILES_ERROR });
    expect(handle.asking.state.answer).toBeNull();
    expect(handle.deps.sessionService.store.get(session.id)?.questionService.hasPending()).toBe(true);
    expect((await handle.deps.sessionService.get(session.id))?.status).toBe("awaiting_input");
  });

  test("an answer that lands after the run ended leaves the terminal status alone", async () => {
    const handle = await openApp();
    close = handle.close;

    const session = await startAskingSession(handle.app);
    await waitForStatus(handle.app, session.id, "awaiting_input");

    await handle.deps.sessionService.transitionStatus(session.id, "failed");
    expect(await handle.deps.sessionService.resume(session.id, { expectedStatus: "awaiting_input" })).toBeNull();
    expect((await handle.deps.sessionService.get(session.id))?.status).toBe("failed");
  });

  test("stopping a waiting session ends the open question", async () => {
    const handle = await openApp();
    close = handle.close;

    const session = await startAskingSession(handle.app);
    await waitForStatus(handle.app, session.id, "awaiting_input");

    await handle.app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });

    await waitForStatus(handle.app, session.id, "cancelled");
    for (let attempt = 0; attempt < 60 && handle.asking.state.askError === null; attempt += 1) await Bun.sleep(25);
    expect(handle.asking.state.askError).toBeInstanceOf(Error);
  });
});
