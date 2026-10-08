import { and, eq, or, sql } from "drizzle-orm";
import type { ResourceAnchor, ResourceRef, ResourceRole } from "pstdio-api-contracts/extension-kernel";
import type { DbClient } from "../db/connection.pglite";
import { resource_anchors as edges } from "../db/schemas/resource-anchors";

type Database = Pick<DbClient, "select" | "insert" | "delete" | "transaction">;
export type CanonicalResource = ResourceRef & { projectId: string; extensionId: string };
type Edge = typeof edges.$inferSelect;

const sourceMatch = (ref: CanonicalResource) =>
  and(
    eq(edges.project_id, ref.projectId),
    eq(edges.source_owner, ref.extensionId),
    eq(edges.source_kind, ref.type),
    eq(edges.source_id, ref.id),
  );
const targetMatch = (ref: CanonicalResource) =>
  and(
    eq(edges.project_id, ref.projectId),
    eq(edges.target_owner, ref.extensionId),
    eq(edges.target_kind, ref.type),
    eq(edges.target_id, ref.id),
  );
const keyColumns = [
  edges.source_owner,
  edges.source_kind,
  edges.source_id,
  edges.target_owner,
  edges.target_kind,
  edges.target_id,
];
const key = (row: Edge) => [
  row.source_owner,
  row.source_kind,
  row.source_id,
  row.target_owner,
  row.target_kind,
  row.target_id,
];
const item = (row: Edge) => ({
  source: { projectId: row.project_id, extensionId: row.source_owner, type: row.source_kind, id: row.source_id },
  target: {
    ...row.details,
    projectId: row.project_id,
    extensionId: row.target_owner,
    type: row.target_kind,
    id: row.target_id,
    role: row.role,
  },
});

// Creation and legacy adapters use this inside their existing database transaction.
export const writeResourceLinks = async (
  db: Database,
  resource: CanonicalResource,
  anchors: ResourceAnchor[],
  details = anchors,
) => {
  const rows = new Map<string, typeof edges.$inferInsert>();
  for (const [position, anchor] of anchors.entries()) {
    if (anchor.projectId && anchor.projectId !== resource.projectId)
      throw new Error("Resource belongs to another project.");
    if (!anchor.extensionId) throw new Error("Resource owner is required.");
    rows.set(JSON.stringify([anchor.extensionId, anchor.type, anchor.id]), {
      project_id: resource.projectId,
      source_owner: resource.extensionId,
      source_kind: resource.type,
      source_id: resource.id,
      target_owner: anchor.extensionId,
      target_kind: anchor.type,
      target_id: anchor.id,
      role: anchor.role ?? "context",
      details: details[position]!,
    });
  }
  if (!rows.size) return [];
  const changed = await db
    .insert(edges)
    .values([...rows.values()])
    .onConflictDoUpdate({
      target: [edges.project_id, ...keyColumns],
      set: { role: sql`excluded.role`, details: sql`excluded.details` },
      setWhere: sql`${edges.role} is distinct from excluded.role or ${edges.details} is distinct from excluded.details`,
    })
    .returning();
  return changed.map(item);
};

const decodeCursor = (cursor: string) => {
  let values: unknown;
  try {
    values = JSON.parse(Buffer.from(cursor, "base64url").toString());
  } catch {
    throw new Error("Invalid resource link cursor.");
  }
  if (!Array.isArray(values) || values.length !== 6 || values.some((value) => typeof value !== "string"))
    throw new Error("Invalid resource link cursor.");

  return values as string[];
};
const refsMatch = (resource: CanonicalResource, refs: ResourceRef[]) =>
  and(
    sourceMatch(resource),
    or(...refs.map((ref) => targetMatch({ ...ref, projectId: resource.projectId, extensionId: ref.extensionId! }))),
  );

export const createResourceLinksDBService = (db: Database) => ({
  add: (resource: CanonicalResource, anchors: ResourceAnchor[]) => writeResourceLinks(db, resource, anchors),
  find: async (resource: CanonicalResource, refs: ResourceRef[]) => {
    if (!refs.length) return [];
    const rows = await db
      .select()
      .from(edges)
      .where(
        and(
          sourceMatch(resource),
          or(
            ...refs.map((ref) => targetMatch({ ...ref, projectId: resource.projectId, extensionId: ref.extensionId! })),
          ),
        ),
      );
    return rows.map(item);
  },
  remove: async (resource: CanonicalResource, refs: ResourceRef[]) => {
    if (!refs.length) return [];
    const changed = await db
      .delete(edges)
      .where(
        and(
          sourceMatch(resource),
          or(
            ...refs.map((ref) => targetMatch({ ...ref, projectId: resource.projectId, extensionId: ref.extensionId! })),
          ),
        ),
      )
      .returning();
    return changed.map(item);
  },
  removeValidated: async (
    resource: CanonicalResource,
    refs: ResourceRef[],
    validated: Array<ReturnType<typeof item>>,
  ) => {
    if (!refs.length) return [];
    return db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(edges)
        .where(refsMatch(resource, refs))
        .orderBy(...keyColumns)
        .for("update");
      const snapshot = (items: Array<ReturnType<typeof item>>) => items.map((edge) => JSON.stringify(edge)).sort();
      if (JSON.stringify(snapshot(current.map(item))) !== JSON.stringify(snapshot(validated))) return null;
      // Lock and compare the complete batch before deleting any validated edge.
      if (!current.length) return [];
      const changed = await tx
        .delete(edges)
        .where(and(sourceMatch(resource), or(...current.map((row) => targetMatch(item(row).target)))))
        .returning();
      return changed.map(item);
    });
  },
  removeResource: async (resource: CanonicalResource) => {
    const changed = await db
      .delete(edges)
      .where(or(sourceMatch(resource), targetMatch(resource)))
      .returning();
    return changed.map(item);
  },
  list: async (input: {
    resource: CanonicalResource;
    direction?: "outgoing" | "incoming" | "both";
    role?: ResourceRole;
    cursor?: string;
    limit?: number;
  }) => {
    const direction = input.direction ?? "outgoing";
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Limit must be between 1 and 100.");
    let match = sourceMatch(input.resource);
    if (direction === "incoming") match = targetMatch(input.resource);
    if (direction === "both") match = or(sourceMatch(input.resource), targetMatch(input.resource));
    const conditions = [match];
    if (input.role) conditions.push(eq(edges.role, input.role));
    if (input.cursor) {
      const values = decodeCursor(input.cursor);
      conditions.push(
        sql`(${sql.join(keyColumns, sql`, `)}) > (${sql.join(
          values.map((value) => sql`${value}`),
          sql`, `,
        )})`,
      );
    }
    const rows = await db
      .select()
      .from(edges)
      .where(and(...conditions))
      .orderBy(...keyColumns)
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    return {
      items: page.map(item),
      ...(rows.length > limit
        ? { nextCursor: Buffer.from(JSON.stringify(key(page.at(-1)!))).toString("base64url") }
        : {}),
    };
  },
});
