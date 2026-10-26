import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("cancelling a turn rejects active control questions and releases the owner", async () => {
  const turnDone = Promise.withResolvers<import("pstdio-api-contracts").HarnessExit>();
  const asking = Promise.withResolvers<void>();
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("cancel-control", {
        provider: {
          start: () => ({ done: turnDone.promise, stop: () => turnDone.resolve({ status: "cancelled" }) }),
          prepareOperation: () => ({
            execution: "control",
            invoke: async ({ questions }) => {
              const answer = questions!.ask({
                id: "ask",
                toolUseId: "tool",
                questions: [{ question: "Color?", options: [] }],
              });
              asking.resolve();
              await answer;
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
  let id = "";
  let pending: Promise<Response> | undefined;
  try {
    const project = await (await post("/projects", folderProjectInput({ name: "Cancellation" }))).json();
    const session = await (
      await post("/sessions", {
        project_id: project.id,
        title: "Cancel",
        prompt: "Hello",
        agent: testHarnessId("cancel-control"),
      })
    ).json();
    id = session.id;
    for (let i = 0; i < 100 && !app.deps.sessionService.store.get(id)?.session; i++) await Bun.sleep(10);
    pending = Promise.resolve(
      post(`/sessions/${id}/harness-commands`, { operation: { kind: "command", text: "/goal" } }),
    );
    await asking.promise;
    await app.deps.sessionService.cancel(id);
    await Bun.sleep(50);

    expect(app.deps.sessionService.store.get(id)?.questionService.hasPending() ?? false).toBe(false);
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(id); i++) await Bun.sleep(10);
    expect(app.deps.sessionService.store.get(id)).toBeNull();
  } finally {
    app.deps.sessionService.store.get(id)?.questionService.dispose();
    turnDone.resolve({ status: "cancelled" });
    await pending;
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(id); i++) await Bun.sleep(10);
    await app.close();
  }
});
