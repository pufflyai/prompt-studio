import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { ArtifactFileProjection } from "pstdio-api-contracts";
import { canonicalOwner } from "pstdio-api-contracts/extension-host";
import type { StorageOwner } from "pstdio-sync";
import { assertArtifactProjectionAdmitted } from "../../db/artifact-projection-admission";
import type { DbClient } from "../../db/connection.pglite";
import { file_projections as projections } from "../../db/schemas/file-projections";
import { installed_extension_sources, project_extensions, workspaces } from "../../db/schemas.pg";
import { assertStorageOwnerAdmitted } from "../../db/storage-admission";
import { jsonBatches } from "./json-batches";
import { ensureStorageOwner, storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const write = async (tx: Transaction, ownerId: number, root: string, state: ArtifactFileProjection) => {
  for (const batch of jsonBatches(Object.entries(state).map(([path, state]) => ({ path, state }))))
    await tx.execute(sql`
      INSERT INTO file_projections (owner_id,root,path,state)
      SELECT ${ownerId},${root},entry.path,entry.state
      FROM jsonb_to_recordset(${batch}::jsonb) AS entry(path text,state jsonb)
      ON CONFLICT (owner_id,root,path) DO UPDATE SET state=excluded.state
      WHERE file_projections.state IS DISTINCT FROM excluded.state`);
};

const pathSelection = (paths?: string[], descendantsOf?: string) =>
  paths
    ? or(
        paths.length ? inArray(projections.path, paths) : undefined,
        descendantsOf ? sql`starts_with(${projections.path}, ${`${descendantsOf}/`})` : undefined,
      )
    : undefined;

export const createArtifactFileProjectionsDBService = (db: DbClient) => ({
  open(key: string, owner: StorageOwner) {
    owner = canonicalOwner(owner);
    const root = JSON.stringify(["artifact", key]);
    const scope = () => and(eq(projections.owner_id, storageOwnerKey(owner)), eq(projections.root, root));
    const initializeRoot = (tx: Transaction, ownerId: number) =>
      tx.insert(projections).values({ owner_id: ownerId, root, path: "" }).onConflictDoNothing().returning();
    return {
      async read(paths?: string[], descendantsOf?: string) {
        assertArtifactProjectionAdmitted(db, key);
        assertStorageOwnerAdmitted(db, owner);
        const [initialized] = await db
          .select({ path: projections.path })
          .from(projections)
          .where(and(scope(), eq(projections.path, "")));
        const state: ArtifactFileProjection = {};
        if (!initialized || (paths?.length === 0 && !descendantsOf)) return { initialized: !!initialized, state };
        const rows = await db
          .select({ path: projections.path, state: projections.state })
          .from(projections)
          .where(and(scope(), pathSelection(paths, descendantsOf)));
        for (const row of rows) if (row.state !== null) state[row.path] = row.state;
        return { initialized: true, state };
      },
      async write(changes: ArtifactFileProjection) {
        assertArtifactProjectionAdmitted(db, key);
        assertStorageOwnerAdmitted(db, owner);
        await db.transaction(async (tx) => {
          const ownerId = await ensureStorageOwner(tx, owner);
          await initializeRoot(tx, ownerId);
          await write(tx, ownerId, root, changes);
        });
      },
      async initialize(state: ArtifactFileProjection) {
        assertArtifactProjectionAdmitted(db, key);
        assertStorageOwnerAdmitted(db, owner);
        return db.transaction(async (tx) => {
          const ownerId = await ensureStorageOwner(tx, owner);
          if (!(await initializeRoot(tx, ownerId)).length) return false;
          await write(tx, ownerId, root, state);
          return true;
        });
      },
    };
  },
  async legacyContexts() {
    const rows = await db
      .selectDistinct({
        workbenchId: workspaces.project_id,
        extensionId: installed_extension_sources.extension_id,
        repoRoot: workspaces.root_path,
      })
      .from(project_extensions)
      .innerJoin(installed_extension_sources, eq(project_extensions.extension_ref, installed_extension_sources.id))
      .innerJoin(workspaces, eq(workspaces.project_id, project_extensions.project_id))
      .where(and(eq(workspaces.execution_kind, "local"), isNotNull(workspaces.root_path)));
    return rows.flatMap(({ workbenchId, extensionId, repoRoot }) =>
      repoRoot ? [{ owner: { workbenchId, extensionId }, repoRoot }] : [],
    );
  },
});
