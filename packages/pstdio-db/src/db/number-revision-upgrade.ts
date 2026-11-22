import { eq } from "drizzle-orm";
import { ensureStorageOwner } from "../services/extension-storage/storage-owner-key";
import type { DbClient } from "./connection.pglite";
import { owners } from "./schemas/owners";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** The document-owner snapshot retains the released graph until every restored table commits. */
export const restoreNumberRevisions = async (tx: Transaction, rows: Record<string, unknown>[]) => {
  for (const row of rows) {
    const revision = Number(row.revision);
    if (typeof row.workbench_id !== "string" || typeof row.extension_id !== "string" || !Number.isSafeInteger(revision))
      throw new Error("Invalid exported number projection position");
    const id = await ensureStorageOwner(tx, { workbenchId: row.workbench_id, extensionId: row.extension_id });
    const [existing] = await tx.select({ revision: owners.numbers_revision }).from(owners).where(eq(owners.id, id));
    if (existing!.revision !== 0 && existing!.revision !== revision)
      throw new Error("Number projection restoration conflict");
    await tx.update(owners).set({ numbers_revision: revision }).where(eq(owners.id, id));
  }
};
