import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PGlite, Transaction } from "@electric-sql/pglite";

async function entries(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

const decodeSegment = (name: string) => {
  const value = Buffer.from(name, "base64url").toString();
  return Buffer.from(value).toString("base64url") === name ? value : undefined;
};

/** Only an unfinished local upload has bytes in an owner’s transfers directory.
 * Completed versions live separately and remain readable by their content hashes. */
export async function stageLocalTransfers(db: PGlite | Transaction, storageRoot: string) {
  await db.exec(
    "CREATE TEMP TABLE IF NOT EXISTS local_upgrade_transfers(project_id text,extension_id text,operation_id text, PRIMARY KEY(project_id,extension_id,operation_id)); TRUNCATE pg_temp.local_upgrade_transfers",
  );
  const root = join(storageRoot, "asset-bytes");
  for (const project of await entries(root)) {
    const projectId = decodeSegment(project.name);
    if (!project.isDirectory() || !projectId) continue;
    for (const owner of await entries(join(root, project.name))) {
      const extensionId = decodeSegment(owner.name);
      if (!owner.isDirectory() || !extensionId) continue;
      const transfers = await entries(join(root, project.name, owner.name, "transfers"));
      const ids = transfers
        .filter((entry) => entry.isFile())
        .map((entry) => decodeSegment(entry.name))
        .filter((id): id is string => !!id);
      if (ids.length)
        await db.query("INSERT INTO pg_temp.local_upgrade_transfers SELECT $1,$2,unnest($3::text[])", [
          projectId,
          extensionId,
          ids,
        ]);
    }
  }
}
