import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { ArtifactFileProjection } from "pstdio-api-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_instances,
  installed_extension_sources,
  artifact_file_projections as projections,
  artifact_file_projection_roots as roots,
  workspaces,
} from "../../db/schemas.pg";
import { jsonBatches } from "./json-batches";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const write = async (tx: Transaction, key: string, state: ArtifactFileProjection) => {
  for (const batch of jsonBatches(Object.entries(state).map(([path, state]) => ({ path, state })))) {
    await tx.execute(sql`
      insert into artifact_file_projections (projection_key, path, state)
      select ${key}, entry.path, entry.state
      from jsonb_to_recordset(${batch}::jsonb) as entry(path text, state jsonb)
      on conflict (projection_key, path) do update set state = excluded.state
      where artifact_file_projections.state is distinct from excluded.state
    `);
  }
};

export const createArtifactFileProjectionsDBService = (db: DbClient) => ({
  open(key: string) {
    return {
      async read(paths?: string[], descendantsOf?: string) {
        const [root] = await db.select().from(roots).where(eq(roots.key, key));
        const state: ArtifactFileProjection = {};
        if (!root || (paths?.length === 0 && !descendantsOf)) return { initialized: !!root, state };
        const rows = await db
          .select({ path: projections.path, state: projections.state })
          .from(projections)
          .where(
            and(
              eq(projections.key, key),
              paths
                ? or(
                    paths.length ? inArray(projections.path, paths) : undefined,
                    descendantsOf ? sql`starts_with(${projections.path}, ${`${descendantsOf}/`})` : undefined,
                  )
                : undefined,
            ),
          );
        for (const row of rows) state[row.path] = row.state;
        return { initialized: true, state };
      },
      write: (changes: ArtifactFileProjection) =>
        db.transaction(async (tx) => {
          await tx.insert(roots).values({ key }).onConflictDoNothing();
          await write(tx, key, changes);
        }),
      initialize: (state: ArtifactFileProjection) =>
        db.transaction(async (tx) => {
          const inserted = await tx.insert(roots).values({ key }).onConflictDoNothing().returning();
          if (!inserted.length) return false;
          await write(tx, key, state);
          return true;
        }),
    };
  },
  async legacyContexts() {
    const rows = await db
      .selectDistinct({
        workbenchId: workspaces.project_id,
        extensionId: installed_extension_sources.extension_id,
        repoRoot: workspaces.root_path,
      })
      .from(extension_instances)
      .innerJoin(
        installed_extension_sources,
        eq(extension_instances.installed_extension_id, installed_extension_sources.id),
      )
      .innerJoin(workspaces, eq(workspaces.project_id, extension_instances.scope_id))
      .where(
        and(
          eq(extension_instances.scope_type, "project"),
          eq(workspaces.execution_kind, "local"),
          isNotNull(workspaces.root_path),
        ),
      );
    return rows.flatMap(({ workbenchId, extensionId, repoRoot }) =>
      repoRoot ? [{ owner: { workbenchId, extensionId }, repoRoot }] : [],
    );
  },
});
