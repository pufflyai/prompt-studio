import { and, eq } from "drizzle-orm";
import { createDataMigrationRunner } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { extension_data_versions } from "../../db/schemas.pg";
import type { KvScope } from "./extension-storage";

export const createStorageMigrations = (db: DbClient) => {
  const pending = new Map<string, Promise<void>>();
  return (scope: KvScope, version: number, run: (previousVersion: number) => Promise<void>) => {
    const key = JSON.stringify([scope.extension_instance_id, scope.scope_type, scope.scope_id]);
    const migrate = async () => {
      await createDataMigrationRunner({
        readVersion: async () => {
          const [stored] = await db
            .select()
            .from(extension_data_versions)
            .where(
              and(
                eq(extension_data_versions.extension_instance_id, scope.extension_instance_id),
                eq(extension_data_versions.scope_type, scope.scope_type),
                eq(extension_data_versions.scope_id, scope.scope_id),
              ),
            );
          return stored?.version ?? 0;
        },
        writeVersion: async (next) => {
          await db
            .insert(extension_data_versions)
            .values({
              extension_instance_id: scope.extension_instance_id,
              scope_type: scope.scope_type,
              scope_id: scope.scope_id,
              version: next,
            })
            .onConflictDoUpdate({
              target: [
                extension_data_versions.extension_instance_id,
                extension_data_versions.scope_type,
                extension_data_versions.scope_id,
              ],
              set: { version: next },
            });
        },
      })(version, run);
    };
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(migrate);
    pending.set(key, result);
    return result.finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    });
  };
};
