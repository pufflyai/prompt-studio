import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionScheduler } from "./session-scheduler";

test("launches a real queued session after quiet maintenance settles without an unrelated workspace event", async () => {
  const root = await mkdtemp(join(tmpdir(), "quiet-maintenance-queue-"));
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let launches = 0;
  const app = await createTestApp({
    databasePath: ":memory:",
    storageRoot: join(root, "storage"),
    harnessRegistry: createTestHarnessRegistry([
      createTestHarnessRecord("maintenance", {
        provider: {
          start: async () => {
            launches++;
            started.resolve();
            return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
          },
          getMessages: () => [],
        },
      }),
    ]),
  });
  try {
    const project = await app.deps.projectService.create({ name: "Maintenance queue" });
    const workspace = await app.deps.workspaceService.createStandalone({
      project_id: project.id,
      provider_state: "ready",
      root_path: root,
    });
    await app.deps.workspaceService.updateProviderProjection(workspace.id, {
      provider_state: "ready",
      execution_kind: "local",
      root_path: root,
      provider_capabilities_json: workspace.provider_capabilities_json,
    });
    const maintenance = app.deps.workspaceService.maintenance.run(workspace.id, () => release.promise);
    const session = await app.deps.sessionService.createQueuedWithEntry(
      {
        project_id: project.id,
        title: "Wait for maintained skills",
        agent: testHarnessId("maintenance"),
        prompt: "go",
        request_kind: "start",
      },
      { emitStartedHook: false },
    );
    await app.deps.workspaceSessionService.link(workspace.id, session.id);
    let workspaceEvents = 0;
    const unsubscribe = app.deps.eventBus.subscribe((event) => {
      if (event.table === "workspaces") workspaceEvents++;
    });
    await createSessionScheduler(app.deps).drainQueue();
    expect(launches).toBe(0);
    expect(await app.deps.sessionService.get(session.id)).toMatchObject({ status: "queued" });
    expect(await app.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);
    release.resolve();
    await maintenance;
    await started.promise;
    expect(launches).toBe(1);
    expect(workspaceEvents).toBe(0);
    unsubscribe();
  } finally {
    release.resolve();
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
