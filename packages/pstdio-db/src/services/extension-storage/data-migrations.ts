import { createDataMigrationRunner } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { dataMigrationContext } from "./data-migration-context";
import type { createDocumentStorageDBService } from "./document-storage";
import type { KvScope } from "./extension-storage";
import { getExtensionStorageOwner } from "./storage-owner";

export const createStorageMigrations = (db: DbClient, documents: ReturnType<typeof createDocumentStorageDBService>) => {
  const pending = new Map<string, Promise<void>>();
  return (scope: KvScope, version: number, run: (previousVersion: number) => Promise<void>) => {
    const key = JSON.stringify([scope.extension_instance_id, scope.scope_type, scope.scope_id]);
    const migrate = async () => {
      const owner = await getExtensionStorageOwner(db, scope.extension_instance_id);
      if (!owner) throw new Error("Storage owner not found");
      const storage = documents.open({ owner });
      const dataScope = JSON.stringify([scope.scope_type, scope.scope_id]);
      await createDataMigrationRunner({
        readVersion: () => storage.dataVersion(dataScope),
        writeVersion: (next) => storage.setDataVersion(dataScope, next),
      })(version, (previous) =>
        dataMigrationContext.run(
          {
            key: JSON.stringify([owner.extensionId, scope.scope_type, scope.scope_id, version]),
            histories: new Map(),
          },
          () => run(previous),
        ),
      );
    };
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(migrate);
    pending.set(key, result);
    return result.finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    });
  };
};
