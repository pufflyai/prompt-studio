import { and, eq } from "drizzle-orm";
import {
  type AssetStore,
  createRecordStorage,
  type GroupedState,
  projectGroups,
  type StorageObserver,
  type StorageOwner,
} from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { extension_storage_journal, extension_storage_owners } from "../../db/schemas.pg";
import { createEnvironmentDBService } from "../environment/environment";
import { createGroupedStorageCache } from "./grouped-storage-cache";
import { decodeAcceptedState, encodeAcceptedState } from "./grouped-storage-codec";
import { saveJournal } from "./grouped-storage-journal";
import { importLegacyStorage } from "./legacy-import";

export const createGroupedStorageDBService = (db: DbClient, observer?: StorageObserver) => {
  const cache = createGroupedStorageCache();
  const listeners = new Set<(owner: StorageOwner) => void>();
  let environment: ReturnType<ReturnType<typeof createEnvironmentDBService>["get"]> | undefined;
  const getEnvironment = () => (environment ??= createEnvironmentDBService(db).get());
  const ownerWhere = (owner: StorageOwner) =>
    and(
      eq(extension_storage_owners.workbench_id, owner.workbenchId),
      eq(extension_storage_owners.extension_id, owner.extensionId),
    );
  const run = async <T>(owner: StorageOwner, action: (state: GroupedState) => Promise<T>) => {
    const { environmentId } = await getEnvironment();
    let changed = false;
    let publish = () => {};
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(extension_storage_owners)
        .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId })
        .onConflictDoNothing();
      const [row] = await tx.select().from(extension_storage_owners).where(ownerWhere(owner)).for("update");
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
      const state: GroupedState = { owner, accepted, journal };
      await importLegacyStorage(tx, state, environmentId);
      const result = await action(state);
      const { changed: appended, metadataChanged } = await saveJournal(tx, state, stored);
      changed = appended;
      const modified = changed || metadataChanged || state.accepted !== accepted;
      const revision = modified ? crypto.randomUUID() : row.revision;
      if (modified) {
        await tx
          .update(extension_storage_owners)
          .set({ revision, ...(state.accepted !== accepted && { accepted_json: encodeAcceptedState(state.accepted) }) })
          .where(ownerWhere(owner));
        publish = await cache.prepare(
          state,
          row.revision,
          revision,
          metadataChanged || state.accepted !== accepted ? null : stored.length,
        );
      }
      return { result, revision };
    });
    publish();
    if (changed) for (const listener of listeners) listener(owner);
    return result;
  };
  const transaction = async <T>(owner: StorageOwner, action: (state: GroupedState) => Promise<T>) =>
    (await run(owner, action)).result;
  const project = async (owner: StorageOwner, environmentId: string) => {
    const [row] = await db
      .select({ revision: extension_storage_owners.revision })
      .from(extension_storage_owners)
      .where(ownerWhere(owner));
    const cached = row && cache.get(owner, environmentId, row.revision);
    if (cached) return cached;
    const { result, revision } = await run(owner, (state) => projectGroups(state, environmentId));
    cache.set(owner, environmentId, revision, result);
    return result;
  };
  return {
    transaction,
    project,
    observer,
    watch(listener: (owner: StorageOwner) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getEnvironment,
    open(input: { owner: StorageOwner; environmentId: string; assets?: AssetStore }) {
      return createRecordStorage({ ...input, store: { transaction, project, observer } });
    },
  };
};
