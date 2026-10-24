import { afterAll, beforeAll, expect, test } from "bun:test";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { startRecoveryCapture } from "./recovery-capture";

let connection: Awaited<ReturnType<typeof createDb>>;
beforeAll(async () => {
  connection = await createDb({ path: ":memory:" });
});
afterAll(async () => {
  await connection.close();
});

const createNotesProject = async (name: string) => {
  const project = await createProjectsDBService(connection.db).create({ name });
  const source = await createInstalledExtensionSourcesDBService(connection.db).register({
    install_name: "notes",
    extension_id: "notes",
    display_name: "Notes",
    source_kind: "local_path",
    source_path: `/builtin/notes/${project.id}`,
  });
  await createExtensionInstancesDBService(connection.db).create({
    installed_extension_id: source.id,
    scope_type: "project",
    scope_id: project.id,
  });
  const storage = createExtensionStorageDBService(connection.db);
  const { records } = await storage.open({ owner: { workbenchId: project.id, extensionId: "notes" } });
  await records.commit({ operationId: "seed", edits: [{ recordId: "note", replace: "Saved" }] });
  return { project, storage };
};

test("recovery points keep rotating after a restart without cloud membership", async () => {
  const { project, storage } = await createNotesProject("Offline recovery");
  await storage.recovery.capture(project.id, new Date(Date.now() - 25 * 3_600_000));
  const reopened = createExtensionStorageDBService(connection.db);
  const capture = startRecoveryCapture({ recovery: reopened.recovery, projects: async () => [] });
  try {
    await capture.capture();
    const points = await reopened.recovery.list(project.id);
    expect(points).toHaveLength(3);
    expect(points.every((point) => Date.parse(point.capturedAt) > Date.now() - 60_000)).toBe(true);
  } finally {
    await capture.close();
  }
});

test("a cloud project gets its first recovery point only after its first download", async () => {
  const { project, storage } = await createNotesProject("Waiting for download");
  let downloaded = false;
  const capture = startRecoveryCapture({
    recovery: storage.recovery,
    projects: async () => (downloaded ? [project.id] : []),
  });
  try {
    await capture.capture();
    expect(await storage.recovery.list(project.id)).toHaveLength(0);
    downloaded = true;
    await capture.capture();
    expect(await storage.recovery.list(project.id)).toHaveLength(3);
  } finally {
    await capture.close();
  }
});
