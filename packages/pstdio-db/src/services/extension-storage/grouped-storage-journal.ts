import { and, eq } from "drizzle-orm";
import type { GroupedState } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { extension_storage_journal } from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export const saveJournal = async (
  tx: Transaction,
  state: GroupedState,
  stored: (typeof extension_storage_journal.$inferSelect)[],
) => {
  const owner = state.owner;
  const appended = state.journal.slice(stored.length).map((entry, index) => ({
    workbench_id: owner.workbenchId,
    extension_id: owner.extensionId,
    operation_id: entry.mutation.operationId,
    ordinal: stored.length + index + 1,
    input_fingerprint: entry.inputFingerprint,
    mutation_json: entry.mutation,
    acceptance_json: entry.acceptance,
    recovery_proof: entry.recoveryProof,
  }));
  for (let index = 0; index < appended.length; index += 500)
    await tx.insert(extension_storage_journal).values(appended.slice(index, index + 500));
  let metadataChanged = false;
  for (let index = 0; index < stored.length; index++) {
    const entry = state.journal[index];
    const original = stored[index];
    if (
      entry.acceptance !== original.acceptance_json ||
      entry.recoveryProof !== (original.recovery_proof ?? undefined)
    ) {
      metadataChanged = true;
      await tx
        .update(extension_storage_journal)
        .set({ acceptance_json: entry.acceptance, recovery_proof: entry.recoveryProof })
        .where(
          and(
            eq(extension_storage_journal.workbench_id, owner.workbenchId),
            eq(extension_storage_journal.extension_id, owner.extensionId),
            eq(extension_storage_journal.operation_id, entry.mutation.operationId),
          ),
        );
    }
  }
  return { changed: appended.length > 0, metadataChanged };
};
