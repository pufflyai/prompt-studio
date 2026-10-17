import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createExtensionInstancesDBService } from "../extension-instances/extension-instances";
import { createInstalledExtensionSourcesDBService } from "../installed-extension-sources/installed-extension-sources";
import { createExtensionStorageDBService } from "./extension-storage";

export const createExtensionStorageFixture = async () => {
  const { db, close } = await createDb({ path: ":memory:" });
  const svc = createExtensionStorageDBService(db);
  const sources = createInstalledExtensionSourcesDBService(db);
  const instances = createExtensionInstancesDBService(db);
  const timestamp = new Date().toISOString();
  const projectAId = crypto.randomUUID();
  const projectBId = crypto.randomUUID();
  await db.insert(projects).values([
    { id: projectAId, name: "A", shorthand: "A", created_at: timestamp, updated_at: timestamp },
    { id: projectBId, name: "B", shorthand: "B", created_at: timestamp, updated_at: timestamp },
  ]);
  const installed = await sources.register({
    install_name: "ext.example",
    extension_id: "ext.example",
    display_name: "Example",
    source_kind: "local_path",
    source_path: "/builtin/example",
  });
  const a = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectAId,
  });
  const b = await instances.create({
    installed_extension_id: installed.id,
    scope_type: "project",
    scope_id: projectBId,
  });
  return { db, close, svc, projectAId, projectBId, instanceAId: a.id, instanceBId: b.id };
};
