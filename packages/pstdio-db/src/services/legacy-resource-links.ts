import { eq, getTableColumns, sql } from "drizzle-orm";
import type { ResourceAnchor, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import type { DbClient } from "../db/connection.pglite";
import { sessions, workspaces } from "../db/schemas.pg";
import { createResourceLinksDBService, writeResourceLinks } from "./resource-links";

export const legacyResourceOwner = (ref: ResourceRef) => {
  if (ref.extensionId) return ref.extensionId;
  if (["workspace", "session", "project"].includes(ref.type)) return "pstdio";
  if (["ticket", "planner-attempt", "planner-review"].includes(ref.type)) return "pstdio.pstdio-planner";
  throw new Error(`Resource owner is required for "${ref.type}".`);
};

export const hostResourceRef = (kind: "workspace" | "session", row: { id: string; project_id: string | null }) => {
  if (!row.project_id) throw new Error("Resource has no project.");
  return { type: kind, id: row.id, projectId: row.project_id, extensionId: "pstdio" };
};

// These read fields survive only until released extensions adopt ctx.resources.
const anchorProjection = (table: typeof workspaces | typeof sessions, kind: string) =>
  sql<ResourceAnchor[]>`(
  select coalesce(jsonb_agg(details order by target_owner, target_kind, target_id), '[]'::jsonb)
  from resource_anchors
  where project_id = ${table.project_id} and source_owner = 'pstdio' and source_kind = ${kind} and source_id = ${table.id}
)`.as("anchors_json");
export const workspaceColumns = {
  ...getTableColumns(workspaces),
  anchors_json: anchorProjection(workspaces, "workspace"),
};
export const sessionColumns = { ...getTableColumns(sessions), anchors_json: anchorProjection(sessions, "session") };

export const writeLegacyResourceLinks = (
  db: Parameters<typeof writeResourceLinks>[0],
  kind: "workspace" | "session",
  row: { id: string; project_id: string | null },
  anchors: ResourceAnchor[],
) =>
  writeResourceLinks(
    db,
    hostResourceRef(kind, row),
    anchors.map((ref) => ({ ...ref, extensionId: legacyResourceOwner(ref), metadata: ref.metadata })),
    anchors,
  );

export const createLegacyAnchorMutations = <Record>(
  db: DbClient,
  kind: "workspace" | "session",
  read: (db: Pick<DbClient, "select">, id: string) => Promise<Record>,
) => {
  const table = kind === "workspace" ? workspaces : sessions;
  const mutate = (id: string, refs: ResourceRef[], operation: "add" | "remove") =>
    db.transaction(async (tx) => {
      const [row] = await tx.select().from(table).where(eq(table.id, id)).for("update");
      if (!row) return null;
      const source = hostResourceRef(kind, row);
      const links = createResourceLinksDBService(tx);
      if (refs.some((ref) => ref.projectId && ref.projectId !== source.projectId))
        throw new Error("Resource belongs to another project.");
      const canonical = refs.map((ref) => ({ ...ref, extensionId: legacyResourceOwner(ref) }));
      const changed =
        operation === "add"
          ? await writeResourceLinks(tx, source, canonical, refs)
          : await links.remove(source, canonical);
      if (!changed.length) return null;
      await tx.update(table).set({ updated_at: new Date().toISOString() }).where(eq(table.id, id));
      return { record: await read(tx, id), changes: changed };
    });
  return {
    addAnchors: (id: string, anchors: ResourceAnchor[]) => mutate(id, anchors, "add"),
    removeAnchors: (id: string, refs: ResourceRef[]) => mutate(id, refs, "remove"),
  };
};
