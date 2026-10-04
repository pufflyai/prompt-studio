import { expect, test } from "bun:test";
import { createTestApp } from "../../../test-utils/create-test-app";
import { folderProjectInput } from "../../../test-utils/folder-project-input";
import {
  createTestHarnessRecord,
  createTestHarnessRegistry,
  testHarnessId,
} from "../../harnesses/test-harness-registry";

test("a new control cannot start after cancellation claims its owner", async () => {
  const turnDone = Promise.withResolvers<import("pstdio-api-contracts").HarnessExit>();
  const stopping = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let invoked = 0;
  const app = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("stopping-control", {
        provider: {
          start: () => ({
            done: turnDone.promise,
            stop: async () => {
              stopping.resolve();
              await release.promise;
              turnDone.resolve({ status: "cancelled" });
            },
          }),
          prepareOperation: () => ({
            execution: "control",
            invoke: async () => {
              invoked++;
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
  let cancelling: Promise<unknown> | undefined;
  try {
    const project = await (await post("/projects", folderProjectInput({ name: "Stopping" }))).json();
    const session = await (
      await post("/sessions", {
        project_id: project.id,
        title: "Stop",
        prompt: "Hello",
        agent: testHarnessId("stopping-control"),
      })
    ).json();
    id = session.id;
    for (let i = 0; i < 100 && !app.deps.sessionService.store.get(id)?.session; i++) await Bun.sleep(10);
    cancelling = app.deps.sessionService.cancel(id);
    await stopping.promise;
    expect(app.deps.sessionService.store.get(id)?.cancellationRequested).toBe(true);
    const response = await post(`/sessions/${id}/harness-commands`, { operation: { kind: "command", text: "/goal" } });

    expect(response.status).toBe(409);
    expect(invoked).toBe(0);
  } finally {
    release.resolve();
    await cancelling;
    for (let i = 0; i < 100 && app.deps.sessionService.store.get(id); i++) await Bun.sleep(10);
    await app.close();
  }
});
