import { expect, test } from "bun:test";
import { createAutomationDBService, createDb, createProjectsDBService } from "pstdio-db";
import { EventBus } from "../sync/event-bus";
import { createAutomationService } from "./automation-service";

for (const automation of [true, false]) {
  test(`recovered queued work ${automation ? "executes an eligible" : "rejects a disabled"} command`, async () => {
    const database = await createDb({ path: ":memory:" });
    const db = createAutomationDBService(database.db);
    const project = await createProjectsDBService(database.db).create({ name: "eligibility" });
    const extensionId = "example.worker";
    const commandId = `${extensionId}.command.run`;
    const principal = await db.getOrCreateExtensionPrincipal({ projectId: project.id, extensionId });
    let executions = 0;
    const service = createAutomationService({
      automationDBService: db,
      getCommandDeps: () =>
        ({
          activityEventsService: { create: async () => {} },
          repoService: { listByProject: async () => [] },
          workspaceService: { getDefault: async () => null },
          eventBus: new EventBus(),
          extensionRuntimeCatalog: {
            get: async () => ({
              project,
              enabledSources: [
                {
                  instance: { id: "instance" },
                  installedSource: { id: "source", extension_id: extensionId, source_path: "/tmp/worker" },
                },
              ],
              runtime: {
                extensions: [{ id: extensionId }],
                hooks: [],
                middlewares: [],
                privateHandlers: [],
                settings: [],
                artifactMounts: [],
                commands: [
                  {
                    id: commandId,
                    extensionId,
                    name: "worker",
                    automation,
                    params: {},
                    run: async () => {
                      executions++;
                      return "done";
                    },
                  },
                ],
              },
            }),
          },
        }) as never,
    });
    try {
      const { run } = await db.createRun({
        projectId: project.id,
        principalId: principal.id,
        tokenId: null,
        commandId,
        idempotencyKey: "queued",
        inputHash: "hash",
        inputJson: { commandId, input: {} },
      });
      await service.recoverQueuedRuns();
      let stored = await db.getRun(project.id, run.id);
      const deadline = Date.now() + 1000;
      while (stored && ["queued", "running"].includes(stored.status) && Date.now() < deadline) {
        await Bun.sleep(10);
        stored = await db.getRun(project.id, run.id);
      }
      expect(stored?.status).toBe(automation ? "succeeded" : "rejected");
      expect(executions).toBe(automation ? 1 : 0);
      if (!automation) expect(stored?.error_json).toMatchObject({ code: "automation_scope_denied" });
    } finally {
      await service.close();
      await database.close();
    }
  });
}
