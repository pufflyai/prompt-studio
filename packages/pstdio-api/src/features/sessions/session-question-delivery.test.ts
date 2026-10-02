import { expect, test } from "bun:test";
import type { HarnessExit, SessionMessage, ToolPart } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";

const openDelayedQuestion = async () => {
  const received = Promise.withResolvers<void>();
  const publish = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<HarnessExit>();
  let resumeCalls = 0;
  let stopped = false;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("delayed-question", {
      provider: {
        start: (_ctx, input) => {
          const tool: ToolPart = {
            type: "tool",
            tool: "question",
            callId: "question-call",
            status: "pending",
            state: { input: { questions: [{ question: "Which color?" }] } },
          };
          const message: SessionMessage = { id: "question-message", role: "assistant", parts: [tool] };
          input.events.push({ op: "add", path: "/messages/0", value: message });
          void input
            .questions!.ask({ id: "ask", toolUseId: "question-call", questions: [{ question: "Which color?" }] })
            .then(
              async () => {
                received.resolve();
                await publish.promise;
                if (stopped) return;
                input.events.push({
                  op: "replace",
                  path: "/messages/0",
                  value: { ...message, parts: [{ ...tool, status: "completed", state: { output: "Blue" } }] },
                });
              },
              () => {},
            );
          return {
            agentSessionId: "delayed-native",
            done: finished.promise,
            stop: () => {
              stopped = true;
              input.events.push({
                op: "replace",
                path: "/messages/0",
                value: {
                  ...message,
                  parts: [{ ...tool, status: "failed", state: { errorText: "Question unavailable" } }],
                },
              });
              finished.resolve({ status: "cancelled" });
            },
          };
        },
        resume: () => {
          resumeCalls++;
          return { agentSessionId: "delayed-native", done: Promise.resolve({ status: "completed" }), stop: () => {} };
        },
        getMessages: () => [],
      },
    }),
  ]);
  const handle = await createTestApp({ harnessRegistry: registry });
  const project = await (
    await handle.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Question delivery" })),
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
        agent: testHarnessId("delayed-question"),
      }),
    })
  ).json();
  for (
    let attempt = 0;
    !handle.deps.sessionService.store.get(session.id)?.questionService.hasPending() && attempt < 50;
    attempt++
  )
    await Bun.sleep(10);
  const answer = async () =>
    handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Blue", question_response: { callId: "question-call", answers: [["Blue"]] } }),
    });
  const cancel = () =>
    handle.app.request(`/v1/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
  const finish = async () => {
    finished.resolve({ status: "completed" });
    for (let attempt = 0; handle.deps.sessionService.store.get(session.id) && attempt < 50; attempt++)
      await Bun.sleep(10);
  };
  const close = async () => {
    publish.resolve();
    finished.resolve({ status: "completed" });
    for (let attempt = 0; handle.deps.sessionService.store.get(session.id) && attempt < 50; attempt++)
      await Bun.sleep(10);
    await handle.close();
  };
  return { answer, received, publish, finished, finish, cancel, close, resumeCalls: () => resumeCalls };
};

test("an answer succeeds only after its question result reaches the conversation", async () => {
  const fixture = await openDelayedQuestion();
  try {
    let settled = false;
    const answer = fixture.answer().then((response) => {
      settled = true;
      return response;
    });
    await fixture.received.promise;
    await Bun.sleep(25);
    expect(settled).toBe(false);
    fixture.publish.resolve();
    expect((await answer).status).toBe(200);
  } finally {
    await fixture.close();
  }
});

test("a repeated answer while the provider publishes its result never starts another turn", async () => {
  const fixture = await openDelayedQuestion();
  try {
    const first = fixture.answer();
    await fixture.received.promise;
    const second = fixture.answer();
    await Bun.sleep(25);
    fixture.publish.resolve();
    fixture.finished.resolve({ status: "completed" });
    expect((await first).status).toBe(200);
    expect((await second).status).toBe(400);
    expect(fixture.resumeCalls()).toBe(0);
  } finally {
    await fixture.close();
  }
});

test("a repeated answer after the run finishes is rejected from saved question history", async () => {
  const fixture = await openDelayedQuestion();
  try {
    fixture.publish.resolve();
    expect((await fixture.answer()).status).toBe(200);
    await fixture.finish();
    expect((await fixture.answer()).status).toBe(400);
    expect(fixture.resumeCalls()).toBe(0);
  } finally {
    await fixture.close();
  }
});

test("cancelling during answer delivery settles the reply without starting another turn", async () => {
  const fixture = await openDelayedQuestion();
  try {
    const answer = fixture.answer();
    await fixture.received.promise;
    expect((await fixture.cancel()).status).toBe(200);
    expect((await answer).status).toBe(400);
    expect(fixture.resumeCalls()).toBe(0);
  } finally {
    await fixture.close();
  }
});
