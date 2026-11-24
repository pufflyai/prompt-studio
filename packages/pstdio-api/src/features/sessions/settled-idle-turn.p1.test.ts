import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { inertSessionChannelHooks } from "./session-store.test-utils";

test("a reply enters an idle run after its previous queue work has settled", async () => {
  const handle = await createTestApp({
    harnessRegistry: createTestHarnessRegistry([createTestHarnessRecord("idle")]),
  });
  try {
    const project = await handle.deps.projectService.create({ name: "Settled idle run" });
    const session = await handle.deps.sessionService.create({
      project_id: project.id,
      title: "Background watcher",
      agent: testHarnessId("idle"),
      last_selected_model: "run-model",
    });
    const received: string[] = [];
    const owner = handle.deps.sessionService.store.create(session.id, inertSessionChannelHooks);
    owner.executionSettings = { model: "run-model", params: {} };
    handle.deps.sessionService.store.setSession(session.id, {
      done: new Promise(() => {}),
      stop: () => {},
      steer: async (input) => {
        received.push(input.prompt);
        owner.conversation!.push({
          op: "add",
          path: `/messages/${owner.conversation!.getMessages().length}`,
          value: { id: input.deliveryId, role: "user", parts: [{ type: "text", text: input.prompt }] },
        });
        return { status: "accepted" };
      },
    });
    owner.turns.idle({ backgroundTasks: [{ id: "watch", description: "Watch for changes" }] });
    await owner.idleDelivery;
    expect(await handle.deps.sessionQueueEntriesService.listUndispatchedBySession(session.id)).toEqual([]);

    const response = await handle.app.request(`/v1/sessions/${session.id}/follow-up`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Open a PR", model: "run-model" }),
    });
    expect(response.status).toBe(200);
    await owner.idleDelivery;

    expect(received).toEqual(["Open a PR"]);
    expect(await handle.deps.sessionQueueEntriesService.listUndispatchedBySession(session.id)).toEqual([]);
    expect(owner.idleTurn).toBeNull();
  } finally {
    await handle.close();
  }
});
