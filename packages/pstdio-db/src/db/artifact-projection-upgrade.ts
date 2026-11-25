import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import { historicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { StorageOwner } from "pstdio-sync";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { file_projections } from "./schemas/file-projections";
import { installed_extension_sources, project_extensions, workspaces } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
const addressKey = (owner: StorageOwner, repoRoot: string) => {
  const extensionId = historicalExtensionId(owner.extensionId);
  return createHash("sha256")
    .update(
      JSON.stringify([
        { workbenchId: owner.workbenchId, extensionId },
        resolve(repoRoot, ".pstdio/extension-storage", extensionId),
      ]),
    )
    .digest("hex");
};
/** Released roots contain only an opaque hash. Recover addresses from current local
 * workspace/install metadata; orphan or ambiguous roots remain exact in the archive. */
const resolveOwners = async (tx: Transaction, keys: Set<string>) => {
  const found = new Map<string, StorageOwner | null>();
  let after: [string, string] | undefined;
  while (true) {
    const { rows } = await tx.execute<{
      workspace: string;
      source: string;
      project: string;
      extension: string;
      root: string;
    }>(sql`
      SELECT w.id AS workspace,s.id AS source,w.project_id AS project,s.extension_id AS extension,w.root_path AS root
      FROM ${project_extensions} e JOIN ${installed_extension_sources} s ON s.id=e.extension_ref
      JOIN ${workspaces} w ON w.project_id=e.project_id
      WHERE w.execution_kind='local' AND w.root_path IS NOT NULL
        ${after ? sql`AND (w.id,s.id)>(${after[0]},${after[1]})` : sql``}
      ORDER BY w.id,s.id LIMIT 200`);
    if (!rows.length) return found;
    for (const row of rows) {
      const owner = { workbenchId: row.project, extensionId: row.extension };
      const key = addressKey(owner, row.root);
      if (!keys.has(key)) continue;
      if (found.has(key) && !isDeepStrictEqual(found.get(key), owner)) found.set(key, null);
      else found.set(key, owner);
    }
    const last = rows.at(-1)!;
    after = [last.workspace, last.source];
  }
};
const restoreProjection = async (
  tx: Transaction,
  table: string,
  input: Record<string, unknown>,
  owner: StorageOwner,
) => {
  const key = String(input.projection_key);
  const ownerId = await ensureStorageOwner(tx, owner);
  const root = JSON.stringify(["artifact", key]);
  const path = table === "artifact_file_projection_roots" ? "" : String(input.path);
  const [existing] = await tx
    .select()
    .from(file_projections)
    .where(
      and(eq(file_projections.owner_id, ownerId), eq(file_projections.root, root), eq(file_projections.path, path)),
    );
  // The root marker may also be the released empty-path entry.
  if (table === "artifact_file_projection_roots") {
    if (!existing) await tx.insert(file_projections).values({ owner_id: ownerId, root, path });
  } else {
    if (existing?.state !== null && existing && !isDeepStrictEqual(existing.state, input.state))
      throw new Error("Artifact file projection restoration conflict");
    await tx
      .insert(file_projections)
      .values({
        owner_id: ownerId,
        root,
        path,
        state: input.state as typeof file_projections.$inferSelect.state,
      })
      .onConflictDoUpdate({
        target: [file_projections.owner_id, file_projections.root, file_projections.path],
        set: { state: input.state as typeof file_projections.$inferSelect.state },
      });
  }
};

export const prepareArtifactProjectionUpgrade = async (db: DbClient, path: string) => {
  const restorations: {
    restore: NonNullable<Awaited<ReturnType<typeof prepareUpgradeSnapshot>>>;
    flush: () => Promise<void>;
  }[] = [];
  for (const table of ["artifact_file_projection_roots", "artifact_file_projections"]) {
    const pending: Record<string, unknown>[] = [];
    let bytes = 0;
    const flush = async () => {
      if (!pending.length) return;
      const batch = pending.splice(0);
      bytes = 0;
      await db.transaction(async (tx) => {
        const owners = await resolveOwners(tx, new Set(batch.map((row) => String(row.projection_key))));
        for (const input of batch) {
          const key = String(input.projection_key);
          const owner = owners.get(key);
          if (!owner) continue;
          await restoreProjection(tx, table, input, owner);
        }
      });
    };
    const restore = await prepareUpgradeSnapshot(
      db,
      path,
      {
        table,
        keys: table === "artifact_file_projection_roots" ? ["projection_key"] : ["projection_key", "path"],
        name: `${table}-owned`,
        archive: table,
      },
      async (row) => {
        const size = Buffer.byteLength(JSON.stringify(row));
        if (pending.length && bytes + size > 4 * 1024 * 1024) await flush();
        pending.push(row);
        bytes += size;
        if (pending.length === 200) await flush();
      },
    );
    if (restore) restorations.push({ restore, flush });
  }
  if (!restorations.length) return;
  return async () => {
    for (const { restore, flush } of restorations) {
      await restore(true);
      await flush();
    }
    for (const { restore } of restorations) await restore.complete();
  };
};
