import { expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { createTestApp } from "../../test-utils/create-test-app";
import { createTestHarnessRecord, createTestHarnessRegistry, testHarnessId } from "../harnesses/test-harness-registry";
import { createSessionScheduler } from "./session-scheduler";

const waitUntil = async (condition: () => boolean | Promise<boolean>) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await condition()) return;
    await Bun.sleep(10);
  }
};

test.each(["archiving", "deleting"] as const)(
  "keeps queued work pending without dispatching while a failed %s operation can be retried",
  async (state) => {
    let starts = 0;
    const registry = createTestHarnessRegistry([
      createTestHarnessRecord("readiness", {
        provider: {
          start: async () => {
            starts += 1;
            return { agentSessionId: "accepted", done: new Promise(() => {}), stop: () => {} };
          },
          getMessages: () => [],
        },
      }),
    ]);
    const app = await createTestApp({ harnessRegistry: registry });
    try {
      const project = await app.deps.projectService.create({ name: "Queue readiness" });
      const workspace = await app.deps.workspaceService.createStandalone({
        project_id: project.id,
        provider_state: "provisioning",
      });
      await app.deps.workspaceService.updateProviderProjection(workspace.id, {
        provider_state: state,
        execution_kind: "local",
        root_path: tmpdir(),
        provider_capabilities_json: workspace.provider_capabilities_json,
        provider_error_json: {
          code: `provider_${state}_failed`,
          message: "Provider call failed.",
          retryable: true,
          occurred_at: new Date().toISOString(),
        },
      });
      const session = await app.deps.sessionService.createQueuedWithEntry(
        { project_id: project.id, title: "Pending work", agent: testHarnessId("readiness"), prompt: "go" },
        { emitStartedHook: false },
      );
      await app.deps.workspaceSessionService.link(workspace.id, session.id);

      // Each dispatch claims the entry, which moves the session from queued to in_progress.
      let dispatches = 0;
      let status = session.status;
      app.deps.eventBus.subscribe((event) => {
        const row = event.data as { id?: string; status?: string } | undefined;
        if (event.table !== "sessions" || row?.id !== session.id || !row.status) return;
        if (status === "queued" && row.status === "in_progress") dispatches += 1;
        status = row.status;
      });

      const draining = createSessionScheduler(app.deps).drainQueue();
      await Bun.sleep(100);

      expect(dispatches).toBe(0);
      expect(await app.deps.sessionService.get(session.id)).toMatchObject({ status: "queued" });
      expect(await app.deps.sessionQueueEntriesService.listPendingBySession(session.id)).toHaveLength(1);

      await app.deps.workspaceService.updateProviderProjection(workspace.id, {
        provider_state: "ready",
        execution_kind: "local",
        root_path: tmpdir(),
        provider_capabilities_json: workspace.provider_capabilities_json,
        provider_error_json: null,
      });
      await waitUntil(() => starts === 1);
      await draining;

      expect(starts).toBe(1);
      expect(dispatches).toBe(1);
    } finally {
      await app.close();
    }
  },
);
