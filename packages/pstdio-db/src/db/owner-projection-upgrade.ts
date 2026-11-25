import { eq } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { owners } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

/** Projection positions join the same owner row as the data; keep the released input until commit. */
export const prepareOwnerProjectionUpgrade = async (db: DbClient, path: string) => {
  const pending: Record<string, unknown>[] = [];
  let pendingBytes = 0;
  const flush = async () => {
    if (!pending.length) return;
    const batch = pending.splice(0);
    pendingBytes = 0;
    await db.transaction(async (tx) => {
      for (const input of batch) {
        if (typeof input.workbench_id !== "string" || typeof input.extension_id !== "string")
          throw new Error("Invalid exported projection owner");
        const revision = Number(input.revision),
          live_count = Number(input.live_count);
        if (!Number.isSafeInteger(revision) || !Number.isSafeInteger(live_count))
          throw new Error("Invalid exported owner projection position");
        const id = await ensureStorageOwner(tx, { workbenchId: input.workbench_id, extensionId: input.extension_id });
        const [existing] = await tx
          .select({ revision: owners.revision, live_count: owners.live_count })
          .from(owners)
          .where(eq(owners.id, id));
        if (
          (existing!.revision !== 0 || existing!.live_count !== 0) &&
          (existing!.revision !== revision || existing!.live_count !== live_count)
        )
          throw new Error("Owner projection restoration conflict");
        await tx.update(owners).set({ revision, live_count }).where(eq(owners.id, id));
      }
    });
  };
  const restore = await prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "storage_record_projections",
      keys: ["workbench_id", "extension_id"],
      name: "storage_record_projections-owners",
      archive: "storage_record_projections",
    },
    async (input) => {
      const bytes = Buffer.byteLength(JSON.stringify(input));
      if (pending.length && pendingBytes + bytes > 4 * 1024 * 1024) await flush();
      pending.push(input);
      pendingBytes += bytes;
      if (pending.length === 200) await flush();
    },
  );
  if (!restore) return;
  return async () => {
    await restore(true);
    await flush();
    await restore.complete();
  };
};
