import { and, eq, ne } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { extension_instances, installed_extension_sources } from "../../db/schemas.pg";

export const getExtensionStorageOwner = async (db: Pick<DbClient, "select">, instanceId: string) => {
  const [instance] = await db
    .select({
      workbenchId: extension_instances.scope_id,
      scopeType: extension_instances.scope_type,
      extensionId: installed_extension_sources.extension_id,
    })
    .from(extension_instances)
    .innerJoin(
      installed_extension_sources,
      eq(extension_instances.installed_extension_id, installed_extension_sources.id),
    )
    .where(eq(extension_instances.id, instanceId));
  if (!instance || instance.scopeType !== "project") return null;
  return { workbenchId: instance.workbenchId, extensionId: instance.extensionId };
};

export const hasOtherStorageProvider = async (
  db: Pick<DbClient, "select">,
  owner: StorageOwner,
  instanceId: string,
) => {
  const [other] = await db
    .select({ id: extension_instances.id })
    .from(extension_instances)
    .innerJoin(
      installed_extension_sources,
      eq(extension_instances.installed_extension_id, installed_extension_sources.id),
    )
    .where(
      and(
        eq(extension_instances.scope_type, "project"),
        eq(extension_instances.scope_id, owner.workbenchId),
        eq(installed_extension_sources.extension_id, owner.extensionId),
        ne(extension_instances.id, instanceId),
      ),
    )
    .limit(1);
  return other !== undefined;
};
