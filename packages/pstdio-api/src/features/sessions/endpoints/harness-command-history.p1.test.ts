import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("idle native controls preserve their replies and read the existing conversation", async () => {
  const sizes: number[] = [];
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("idle-control", {
        provider: {
          prepareOperation: () => ({
            execution: "control",
            invoke: async ({ events }) => {
              sizes.push(events.getMessages().length);
              events.push({
                op: "add",
                path: `/messages/${events.getMessages().length}`,
                value: {
                  id: `native-${sizes.length}`,
                  role: "assistant",
                  parts: [{ type: "text", text: "Native reply" }],
                },
              });
              return { kind: "completed" };
            },
          }),
        },
      }),
    ]),
  });
  const post = (path: string, body: unknown) =>
    app.app.request(`/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const project = await (await post("/projects", folderProjectInput({ name: "Native history" }))).json();
    const session = await (
      await post("/sessions", {
        project_id: project.id,
        title: "Idle",
        prompt: "Hello",
        agent: testHarnessId("idle-control"),
      })
    ).json();
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(session.id); i++) await Bun.sleep(10);
    for (let invocation = 0; invocation < 2; invocation++) {
      const response = await post(`/sessions/${session.id}/harness-commands`, {
        operation: { kind: "command", text: "/goal" },
      });
      expect(response.status).toBe(200);
      for (let i = 0; i < 100 && app.deps.sessionService.store.get(session.id); i++) await Bun.sleep(10);
    }
    expect(sizes).toEqual([0, 1]);
    const history = await (await app.app.request(`/v1/sessions/${session.id}/conversation`)).json();
    expect(history.messages.map((message: { id: string }) => message.id)).toEqual(["native-1", "native-2"]);
  } finally {
    await app.close();
  }
});

test("started commands receive real approval and question answers", async () => {
  const asking = Promise.withResolvers<void>();
  const approving = Promise.withResolvers<void>();
  const complete = Promise.withResolvers<void>();
  const received: Array<
    import("pstdio-api-contracts").ApprovalResponse | import("pstdio-api-contracts").QuestionResponse
  > = [];
  let resumes = 0;
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("channels", {
        provider: {
          resume: () => {
            resumes++;
            throw new Error("must not resume");
          },
          prepareOperation: () => ({
            execution: "exclusive",
            invoke: async (input) => {
              const done = (async () => {
                const approval = input.approvals!.requestApproval({
                  id: "approval",
                  toolName: "write",
                  toolInput: {},
                  toolUseId: "tool",
                });
                approving.resolve();
                received.push(await approval);
                const question = input.questions!.ask({
                  id: "question",
                  toolUseId: "question-tool",
                  questions: [{ question: "Which color?", options: [] }],
                });
                asking.resolve();
                received.push(await question);
                input.events.push({
                  op: "add",
                  path: `/messages/${input.events.getMessages().length}`,
                  value: { id: "final", role: "assistant", parts: [{ type: "text", text: "Approved and answered" }] },
                });
                complete.resolve();
                return { status: "completed" as const };
              })();
              return { kind: "started", session: { agentSessionId: "thread", done, stop: () => {} } };
            },
          }),
        },
      }),
    ]),
  });
  const post = (path: string, body: unknown) =>
    app.app.request(`/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const project = await (await post("/projects", folderProjectInput({ name: "Channels" }))).json();
    const session = await (
      await post("/sessions", {
        project_id: project.id,
        title: "Channels",
        prompt: "Hello",
        agent: testHarnessId("channels"),
      })
    ).json();
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(session.id); i++) await Bun.sleep(10);
    const response = await post(`/sessions/${session.id}/harness-commands`, {
      operation: { kind: "command", text: "/goal" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "started" });
    await approving.promise;
    const owner = app.deps.sessionService.store.get(session.id);
    expect((await post(`/sessions/${session.id}/approve`, { id: "approval", decision: "approve" })).status).toBe(200);
    await asking.promise;
    for (let i = 0; i < 100 && (await app.deps.sessionService.get(session.id))?.status !== "awaiting_input"; i++)
      await Bun.sleep(10);
    expect((await app.deps.sessionService.get(session.id))?.status).toBe("awaiting_input");
    expect(
      (
        await post(`/sessions/${session.id}/follow-up`, {
          prompt: "Blue",
          question_response: { callId: "question-tool", answers: [["Blue"]] },
        })
      ).status,
    ).toBe(200);
    expect(app.deps.sessionService.store.get(session.id)).toBe(owner);
    await complete.promise;
    expect(received).toEqual([
      { id: "approval", decision: "approve" },
      { callId: "question-tool", answers: [["Blue"]] },
    ]);
    expect(resumes).toBe(0);
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(session.id); i++) await Bun.sleep(10);
    const history = await (await app.app.request(`/v1/sessions/${session.id}/conversation`)).json();
    expect(history.messages).toContainEqual(expect.objectContaining({ id: "final" }));
  } finally {
    await app.close();
  }
});
