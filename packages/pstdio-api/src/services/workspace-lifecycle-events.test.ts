import { expect, test } from "bun:test";
import { createDb, createProjectsDBService, createSessionsDBService, createWorkspacesDBService } from "pstdio-db";
import { EventBus } from "../features/sync/event-bus";
import { createWorkspaceService } from "./workspace-service";

test("workspace lifecycle events follow each stored creation and deletion once", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Lifecycle" });
    const events: Array<[string, string]> = [];
    const service = createWorkspaceService({
      workspacesDb: createWorkspacesDBService(connection.db),
      sessionsDb: createSessionsDBService(connection.db),
      eventBus: new EventBus(),
      onCreated: (workspace) => {
        events.push(["created", workspace.id]);
      },
      onDeleted: (workspace) => {
        events.push(["deleted", workspace.id]);
      },
    });
    const home = await service.ensureDefault({ project_id: project.id, name: "Home" });
    expect(await service.ensureDefault({ project_id: project.id, name: "Home" })).toMatchObject({ id: home.id });
    const workspace = await service.createStandalone({ project_id: project.id });
    await Promise.all([service.softDelete(workspace.id), service.softDelete(workspace.id)]);
    expect(events).toEqual([
      ["created", home.id],
      ["created", workspace.id],
      ["deleted", workspace.id],
    ]);
  } finally {
    await connection.close();
  }
});
