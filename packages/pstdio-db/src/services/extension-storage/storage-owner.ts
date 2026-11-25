import { and, eq, ne } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { installed_extension_sources, project_extensions } from "../../db/schemas.pg";
import { parseProjectExtensionId, projectExtensionWhere } from "../extension-instances/project-extension-row";

export const getExtensionStorageOwner = async (db: Pick<DbClient, "select">, instanceId: string) => {
  const [instance] = await db
    .select({ workbenchId: project_extensions.project_id, extensionId: installed_extension_sources.extension_id })
    .from(project_extensions)
    .innerJoin(installed_extension_sources, eq(project_extensions.extension_ref, installed_extension_sources.id))
    .where(projectExtensionWhere(instanceId));
  if (!instance) return null;
  return instance;
};
export const hasOtherStorageProvider = async (
  db: Pick<DbClient, "select">,
  owner: StorageOwner,
  instanceId: string,
) => {
  const key = parseProjectExtensionId(instanceId);
  if (!key || key.projectId !== owner.workbenchId) return false;
  const [other] = await db
    .select({ id: project_extensions.extension_ref })
    .from(project_extensions)
    .innerJoin(installed_extension_sources, eq(project_extensions.extension_ref, installed_extension_sources.id))
    .where(
      and(
        eq(project_extensions.project_id, owner.workbenchId),
        eq(installed_extension_sources.extension_id, owner.extensionId),
        ne(project_extensions.extension_ref, key.extensionRef),
      ),
    )
    .limit(1);
  return other !== undefined;
};
