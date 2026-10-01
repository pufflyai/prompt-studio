import { expect, test } from "bun:test";
import type { HarnessExit, QuestionResponse } from "pstdio-api-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";

for (const hasNative of [true, false]) {
  test(`routes host question answers with ${hasNative ? "a native channel" : "no native channel"}`, async () => {
    const finished = Promise.withResolvers<HarnessExit>();
    const hostAnswered = Promise.withResolvers<QuestionResponse>();
    const nativeAnswers: QuestionResponse[] = [];
    let stopped = false;
    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("combined-questions", {
        provider: {
          start: (_ctx, input) => {
            void input
              .questions!.ask({
                id: "host-request",
                toolUseId: "host-tool",
                questions: [{ question: "Which color?", options: [{ label: "Blue" }] }],
              })
              .then(hostAnswered.resolve, () => {});
            return {
              agentSessionId: "combined-thread",
              done: finished.promise,
              stop: () => {
                stopped = true;
              },
              replyQuestion: hasNative
                ? async (response: QuestionResponse) => {
                    if (response.callId !== "native-tool")
                      throw Object.assign(new Error("Native question request is no longer pending."), {
                        questionRejected: true,
                      });
                    nativeAnswers.push(response);
                  }
                : undefined,
            };
          },
          resume: () => {
            throw new Error("A question answer must keep its live run");
          },
          getMessages: () => [],
        },
      }),
    ]);
    const handle = await createTestApp({ harnessRegistry: registry });
    let sessionId: string | undefined;
    try {
      const project = await (
        await handle.app.request("/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(folderProjectInput({ name: "Combined questions" })),
        })
      ).json();
      const created = await handle.app.request("/v1/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: "Ask",
          prompt: "Ask",
          agent: testHarnessId("combined-questions"),
        }),
      });
      expect(created.status).toBe(201);
      const session = await created.json();
      sessionId = session.id;
      for (
        let attempt = 0;
        (await handle.deps.sessionService.get(session.id))?.status !== "awaiting_input" && attempt < 50;
        attempt++
      )
        await Bun.sleep(10);
      expect((await handle.deps.sessionService.get(session.id))?.status).toBe("awaiting_input");
      const owner = handle.deps.sessionService.store.get(session.id);
      const started = (await handle.deps.sessionService.get(session.id))?.last_request_started;
      const answer = (callId: string) =>
        handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: "Blue", question_response: { callId, answers: [["Blue"]] } }),
        });

      if (hasNative) {
        expect((await answer("native-tool")).status).toBe(200);
        expect(nativeAnswers).toEqual([{ callId: "native-tool", answers: [["Blue"]] }]);
      }
      expect(owner?.questionService.hasPending()).toBe(true);
      expect((await answer("stale-tool")).status).toBe(400);
      expect(owner?.questionService.hasPending()).toBe(true);
      expect((await handle.deps.sessionService.get(session.id))?.last_request_started).toBe(started);

      const reply = await answer("host-tool");
      expect(reply.status).toBe(200);
      expect(await reply.json()).toMatchObject({ follow_up: { status: "dispatched" } });
      expect(await hostAnswered.promise).toEqual({ callId: "host-tool", answers: [["Blue"]] });
      expect(nativeAnswers).toHaveLength(hasNative ? 1 : 0);
      expect(stopped).toBe(false);
      expect(handle.deps.sessionService.store.get(session.id)).toBe(owner);
      expect(await handle.deps.sessionQueueEntriesService.listPending()).toEqual([]);
    } finally {
      finished.resolve({ status: "completed" });
      for (let attempt = 0; sessionId && handle.deps.sessionService.store.get(sessionId) && attempt < 50; attempt++)
        await Bun.sleep(10);
      await handle.close();
    }
  });
}
