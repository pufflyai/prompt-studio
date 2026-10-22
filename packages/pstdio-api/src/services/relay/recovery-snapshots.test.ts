import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { startRecoverySnapshots } from "./recovery-snapshots";

let connection: Awaited<ReturnType<typeof createDb>>;
beforeAll(async () => {
  connection = await createDb({ path: ":memory:" });
});
afterAll(async () => {
  await connection.close();
});

const registerNotes = async (projectId: string) => {
  const source = await createInstalledExtensionSourcesDBService(connection.db).register({
    install_name: "notes",
    extension_id: "notes",
    display_name: "Notes",
    source_kind: "local_path",
    source_path: `/builtin/notes/${projectId}`,
  });
  await createExtensionInstancesDBService(connection.db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: projectId,
  });
};

test("recovery history keeps rotating after an offline restart without manager or relay membership", async () => {
  const project = await createProjectsDBService(connection.db).create({ name: "Offline recovery" });
  await registerNotes(project.id);
  const first = createExtensionStorageDBService(connection.db);
  const storage = await first.open({ owner: { workbenchId: project.id, extensionId: "notes" } });
  await storage.records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "Before" }] });
  await first.snapshots.capture(project.id, new Date(Date.now() - 25 * 3600000));
  await storage.records.commit({ operationId: "offline", edits: [{ recordId: "note", replace: "Offline edit" }] });
  const reopened = createExtensionStorageDBService(connection.db);
  const recovery = startRecoverySnapshots({ storage: reopened, projects: () => [] });
  try {
    await recovery.capture();
    const points = await reopened.snapshots.list(project.id);
    expect(points).toHaveLength(3);
    expect(points.every((point) => Date.parse(point.capturedAt) > Date.now() - 60000)).toBe(true);
    const store = await reopened.open({ owner: { workbenchId: project.id, extensionId: "notes" } });
    await store.records.commit({ operationId: "delete", edits: [{ recordId: "note", deleted: true }] });
    await reopened.snapshots.restore(project.id, points[0]!);
    expect((await store.records.read("note")).value).toBe("Offline edit");
  } finally {
    await recovery.close();
  }
});

test("new projects are not captured until initial sync makes them eligible", async () => {
  const project = await createProjectsDBService(connection.db).create({ name: "Waiting for download" });
  await registerNotes(project.id);
  const storage = createExtensionStorageDBService(connection.db);
  await storage.documents.list({ workbenchId: project.id, extensionId: "notes" });
  let ready = false;
  const recovery = startRecoverySnapshots({ storage, projects: () => (ready ? [project.id] : []) });
  try {
    await recovery.capture();
    expect(await storage.snapshots.list(project.id)).toHaveLength(0);
    ready = true;
    await recovery.capture();
    expect(await storage.snapshots.list(project.id)).toHaveLength(3);
  } finally {
    await recovery.close();
  }
});
