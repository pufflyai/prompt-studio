import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("an active control retains its reply when its original turn finishes", async () => {
  const turnDone = Promise.withResolvers<import("pstdio-api-contracts").HarnessExit>();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("control-race", {
        provider: {
          start: () => ({
            agentSessionId: "thread",
            done: turnDone.promise,
            stop: () => turnDone.resolve({ status: "cancelled" }),
          }),
          prepareOperation: () => ({
            execution: "control",
            invoke: async ({ events }) => {
              entered.resolve();
              await release.promise;
              events.push({
                op: "add",
                path: `/messages/${events.getMessages().length}`,
                value: {
                  id: "control-reply",
                  role: "assistant",
                  parts: [{ type: "text", text: "Native control completed" }],
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
  let sessionId = "";
  try {
    const project = await (await post("/projects", folderProjectInput({ name: "Race" }))).json();
    const session = await (
      await post("/sessions", {
        project_id: project.id,
        title: "Race",
        prompt: "Hello",
        agent: testHarnessId("control-race"),
      })
    ).json();
    sessionId = session.id;
    for (let i = 0; i < 100 && !app.deps.sessionService.store.get(session.id)?.session; i++) await Bun.sleep(10);
    const result = Promise.resolve(
      post(`/sessions/${session.id}/harness-commands`, { operation: { kind: "command", text: "/goal pause" } }),
    );
    await entered.promise;
    turnDone.resolve({ status: "completed" });
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(session.id); i++) await Bun.sleep(10);
    release.resolve();
    const response = await result;
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(session.id); i++) await Bun.sleep(10);
    const history = await (await app.app.request(`/v1/sessions/${session.id}/conversation`)).json();
    expect(response.status).toBe(200);
    expect(history.messages).toContainEqual(expect.objectContaining({ id: "control-reply" }));
  } finally {
    release.resolve();
    turnDone.resolve({ status: "completed" });
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(sessionId); i++) await Bun.sleep(10);
    await app.close();
  }
});
