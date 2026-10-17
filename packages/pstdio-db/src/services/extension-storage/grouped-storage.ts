import { and, eq } from "drizzle-orm";
import {
  type AssetStore,
  createRecordStorage,
  type GroupedState,
  type StorageObserver,
  type StorageOwner,
} from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { extension_storage_journal, extension_storage_owners } from "../../db/schemas.pg";
import { createEnvironmentDBService } from "../environment/environment";
import { decodeAcceptedState, encodeAcceptedState } from "./grouped-storage-codec";
import { importLegacyStorage } from "./legacy-import";

export const createGroupedStorageDBService = (db: DbClient, observer?: StorageObserver) => {
  const listeners = new Set<(owner: StorageOwner) => void>();
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const transaction = async <T>(owner: StorageOwner, action: (state: GroupedState) => Promise<T>) => {
    const { environmentId } = await getEnvironment();
    let changed = false;
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(extension_storage_owners)
        .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(extension_storage_owners)
        .where(
          and(
            eq(extension_storage_owners.workbench_id, owner.workbenchId),
            eq(extension_storage_owners.extension_id, owner.extensionId),
          ),
        )
        .for("update");
      const stored = await tx
        .select()
        .from(extension_storage_journal)
        .where(
          and(
            eq(extension_storage_journal.workbench_id, owner.workbenchId),
            eq(extension_storage_journal.extension_id, owner.extensionId),
          ),
        )
        .orderBy(extension_storage_journal.ordinal);
      const journal = stored.map((entry) => ({
        inputFingerprint: entry.input_fingerprint,
        mutation: entry.mutation_json,
        acceptance: entry.acceptance_json,
        recoveryProof: entry.recovery_proof ?? undefined,
      }));
      const accepted = decodeAcceptedState(row.accepted_json, journal);
      const state: GroupedState = {
        owner,
        accepted,
        journal,
      };
      await importLegacyStorage(tx, state, environmentId);
      const result = await action(state);
      for (let index = stored.length; index < state.journal.length; index++) {
        const entry = state.journal[index];
        await tx.insert(extension_storage_journal).values({
          workbench_id: owner.workbenchId,
          extension_id: owner.extensionId,
          operation_id: entry.mutation.operationId,
          ordinal: index + 1,
          input_fingerprint: entry.inputFingerprint,
          mutation_json: entry.mutation,
          acceptance_json: entry.acceptance,
          recovery_proof: entry.recoveryProof,
        });
      }
      const originals = new Map(stored.map((row) => [row.operation_id, row]));
      for (const entry of state.journal.slice(0, stored.length)) {
        const original = originals.get(entry.mutation.operationId)!;
        if (
          entry.acceptance !== original.acceptance_json ||
          entry.recoveryProof !== (original.recovery_proof ?? undefined)
        )
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
      if (state.accepted !== accepted)
        await tx
          .update(extension_storage_owners)
          .set({ accepted_json: encodeAcceptedState(state.accepted) })
          .where(
            and(
              eq(extension_storage_owners.workbench_id, owner.workbenchId),
              eq(extension_storage_owners.extension_id, owner.extensionId),
            ),
          );
      changed = state.journal.length > stored.length;
      return result;
    });
    if (changed) for (const listener of listeners) listener(owner);
    return result;
  };
  return {
    transaction,
    observer,
    watch(listener: (owner: StorageOwner) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getEnvironment,
    open(input: { owner: StorageOwner; environmentId: string; assets?: AssetStore }) {
      return createRecordStorage({ ...input, store: { transaction, observer } });
    },
  };
};
