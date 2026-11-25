import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { owners } from "../../db/schemas/owners";

export const storageOwnerWhere = (owner: StorageOwner) =>
  and(eq(owners.project_id, owner.workbenchId), eq(owners.extension_id, owner.extensionId));

// Resolve within the statement, rather than caching a key that project or owner
// deletion can invalidate. Reads do not create empty owners or rewrite live rows.
export const storageOwnerKey = (owner: StorageOwner) =>
  sql<number>`(SELECT id FROM owners WHERE project_id = ${owner.workbenchId} AND extension_id = ${owner.extensionId})`;

export const ensureStorageOwner = async (db: Pick<DbClient, "select" | "insert">, owner: StorageOwner) => {
  const [existing] = await db.select({ id: owners.id }).from(owners).where(storageOwnerWhere(owner));
  if (existing) return existing.id;
  const [created] = await db
    .insert(owners)
    .values({ project_id: owner.workbenchId, extension_id: owner.extensionId })
    .onConflictDoUpdate({
      target: [owners.project_id, owners.extension_id],
      set: { extension_id: owners.extension_id },
    })
    .returning({ id: owners.id });
  return created!.id;
};
