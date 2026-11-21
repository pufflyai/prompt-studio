import { expect, test } from "bun:test";
import { createAutomationDBService, createDb, createProjectsDBService } from "pstdio-db";
import { createAutomationRunExecutor } from "./automation-execution";

test("notification lookup failures cannot prevent durable command execution", async () => {
  const database = await createDb({ path: ":memory:" });
  try {
    const db = createAutomationDBService(database.db);
    const project = await createProjectsDBService(database.db).create({ name: "notification-failure" });
    const principal = await db.getExtensionPrincipal({ projectId: project.id, extensionId: "test.worker" });
    const { run } = await db.createRun({
      projectId: project.id,
      principalId: principal.id,
      tokenId: null,
      commandId: "test.worker.command.run",
      idempotencyKey: "run",
      inputHash: "hash",
      inputJson: { input: {} },
    });
    const executor = createAutomationRunExecutor({
      automationDBService: db,
      getCommandDeps: () =>
        ({
          activityEventsService: { create: async () => {} },
          extensionRuntimeCatalog: {
            get: async () => {
              throw new Error("notification lookup unavailable");
            },
          },
        }) as never,
      executeCommand: async () => ({ outcome: { ok: true, value: "finished" } }) as never,
    });
    await executor.executeRun(run.id, new AbortController().signal);
    expect(await db.getRun(project.id, run.id)).toMatchObject({ status: "succeeded", result_json: "finished" });
  } finally {
    await database.close();
  }
});
