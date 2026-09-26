import { expect, test } from "bun:test";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { dispatchQueuedEntry } from "./session-queue-dispatch";

test.each(["start", "follow_up", "resume"])("keeps a queued %s for retry when startup is not ready", async (kind) => {
  let starts = 0;
  const registry = createTestHarnessRegistry([
    createTestHarnessRecord("retry", {
      provider: {
        start: async () => {
          starts += 1;
          return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
        },
        resume: async () => {
          starts += 1;
          return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
        },
        getMessages: () => [],
      },
    }),
  ]);
  const app = await createTestApp({ harnessRegistry: registry });
  try {
    const project = await app.deps.projectService.create({ name: "Retry queued work" });
    const workspace = await app.deps.workspaceService.createStandalone({
      project_id: project.id,
      provider_state: "provisioning",
    });
    const session = await app.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Pending work",
        agent: testHarnessId("retry"),
        prompt: "keep this prompt",
        request_kind: kind === "start" ? "start" : "follow_up",
      },
      { emitStartedHook: false },
    );
    if (kind === "resume") await app.deps.sessionService.update(session.id, { agent_session_id: "previous" });
    await app.deps.workspaceSessionService.link(workspace.id, session.id);
    const dispatch = async () => {
      const [entry] = await app.deps.sessionQueueEntriesService.listPendingBySession(session.id);
      await dispatchQueuedEntry(app.deps, (await app.deps.sessionService.get(session.id))!, entry!);
    };
    await dispatch();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await app.deps.sessionService.get(session.id))?.status === "queued") break;
      await Bun.sleep(10);
    }
    expect(starts).toBe(0);
    expect(await app.deps.sessionService.get(session.id)).toMatchObject({ status: "queued" });
    expect(await app.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
    await app.deps.workspaceService.updateProviderProjection(workspace.id, {
      provider_state: "ready",
      execution_kind: "local",
      provider_capabilities_json: workspace.provider_capabilities_json,
    });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (starts === 1 && (await app.deps.sessionQueueEntriesService.listDispatchStarted()).length === 0) break;
      await Bun.sleep(10);
    }
    expect(starts).toBe(1);
    expect(await app.deps.sessionQueueEntriesService.listDispatchStarted()).toEqual([]);
  } finally {
    await app.close();
  }
});
