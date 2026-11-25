import { eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { DbClient } from "../db/connection.pglite";
import { resource_links as edges, owners } from "../db/schemas.pg";

export const sourceOwner = alias(owners, "link_source_owner");
export const targetOwner = alias(owners, "link_target_owner");
export type ResourceLinkRow = Omit<typeof edges.$inferSelect, "source_owner" | "target_owner"> & {
  project_id: string;
  source_owner: string;
  target_owner: string;
};

export const resourceLinkQuery = (db: Pick<DbClient, "select">) =>
  db
    .select({
      ...getTableColumns(edges),
      project_id: sourceOwner.project_id,
      source_owner: sourceOwner.extension_id,
      target_owner: targetOwner.extension_id,
    })
    .from(edges)
    .innerJoin(sourceOwner, eq(edges.source_owner, sourceOwner.id))
    .innerJoin(targetOwner, eq(edges.target_owner, targetOwner.id));

// Public addresses and paging stay logical; the stored endpoints share the owner registry.
export const resourceLinkRows = sql`(SELECT s.project_id,s.extension_id AS source_owner,
  l.source_kind,l.source_id,t.extension_id AS target_owner,l.target_kind,l.target_id,l.role,l.details
  FROM resource_links l JOIN owners s ON s.id=l.source_owner JOIN owners t ON t.id=l.target_owner)`;

export const resolveResourceLinkRows = async (db: Pick<DbClient, "select">, rows: (typeof edges.$inferSelect)[]) => {
  if (!rows.length) return [];
  const ids = [...new Set(rows.flatMap((row) => [row.source_owner, row.target_owner]))];
  const found = await db.select().from(owners).where(inArray(owners.id, ids));
  const registry = new Map(found.map((owner) => [owner.id, owner]));
  return rows.map((row) => {
    const source = registry.get(row.source_owner)!;
    const target = registry.get(row.target_owner)!;
    return {
      ...row,
      project_id: source.project_id,
      source_owner: source.extension_id,
      target_owner: target.extension_id,
    };
  });
};
