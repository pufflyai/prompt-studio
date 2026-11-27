import { eq, type SQL, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { owners } from "../../db/schemas/owners";
import type { FirstRecordLookups } from "./record-first-match";
import { storageOwnerKey } from "./storage-owner-key";

export type QuerySqlOwner = {
  workbenchId: string | SQL;
  extensionId: string | SQL;
  ownerId?: number | SQL;
  firstMatches?: FirstRecordLookups;
};
export const queryOwnerKey = (owner: QuerySqlOwner) => {
  if (owner.ownerId === undefined)
    return sql`(SELECT id FROM owners WHERE project_id=${owner.workbenchId} AND extension_id=${owner.extensionId})`;
  return typeof owner.ownerId === "number" ? sql.raw(String(owner.ownerId)) : owner.ownerId;
};
export const rowQueryOwner = (alias: string): QuerySqlOwner => {
  const id = sql`${sql.identifier(alias)}.owner_id`;
  return {
    ownerId: id,
    workbenchId: sql`(SELECT project_id FROM owners WHERE id=${id})`,
    extensionId: sql`(SELECT extension_id FROM owners WHERE id=${id})`,
  };
};

/** Resolve inside the caller's transaction so partial-index predicates use this owner's current key. */
export const readQueryOwner = async (tx: Pick<DbClient, "select">, owner: StorageOwner) => {
  const [physical] = await tx
    .select({ id: owners.id, coreOwnerId: storageOwnerKey({ ...owner, extensionId: "pstdio" }) })
    .from(owners)
    .where(eq(owners.id, storageOwnerKey(owner)));
  return { ...owner, ownerId: physical?.id ?? -1, coreOwnerId: physical?.coreOwnerId ?? null };
};
