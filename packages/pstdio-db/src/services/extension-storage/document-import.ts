import { and, eq } from "drizzle-orm";
import {
  createDocumentStorage,
  type GroupedState,
  memoryDocumentState,
  projectGroups,
  type StorageOwner,
} from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_data_versions,
  extension_instances,
  extension_storage_journal,
  extension_storage_owners,
  installed_extension_sources,
} from "../../db/schemas.pg";
import { decodeAcceptedState } from "./grouped-storage-codec";
import { importLegacyStorage } from "./legacy-import";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** The old projector is used only on the first open, while the new document row is locked. */
export const importOwnerDocument = async (tx: Transaction, owner: StorageOwner, environmentId: string) => {
  const where = and(
    eq(extension_storage_owners.workbench_id, owner.workbenchId),
    eq(extension_storage_owners.extension_id, owner.extensionId),
  );
  const [row] = await tx.select().from(extension_storage_owners).where(where);
  const journal = (
    await tx
      .select()
      .from(extension_storage_journal)
      .where(
        and(
          eq(extension_storage_journal.workbench_id, owner.workbenchId),
          eq(extension_storage_journal.extension_id, owner.extensionId),
        ),
      )
      .orderBy(extension_storage_journal.ordinal)
  ).map((entry) => ({
    inputFingerprint: entry.input_fingerprint,
    mutation: entry.mutation_json,
    acceptance: entry.acceptance_json,
    recoveryProof: entry.recovery_proof ?? undefined,
  }));
  const state: GroupedState = { owner, accepted: decodeAcceptedState(row?.accepted_json ?? null, journal), journal };
  await importLegacyStorage(tx, state, environmentId);
  const view = await projectGroups(state, environmentId);
  const records = [...view.records.keys()].sort().map(view.read);
  const versions = await tx
    .select({
      scope: extension_data_versions.scope_type,
      id: extension_data_versions.scope_id,
      version: extension_data_versions.version,
    })
    .from(extension_data_versions)
    .innerJoin(extension_instances, eq(extension_data_versions.extension_instance_id, extension_instances.id))
    .innerJoin(
      installed_extension_sources,
      eq(extension_instances.installed_extension_id, installed_extension_sources.id),
    )
    .where(
      and(
        eq(extension_instances.scope_type, "project"),
        eq(extension_instances.scope_id, owner.workbenchId),
        eq(installed_extension_sources.extension_id, owner.extensionId),
      ),
    )
    .orderBy(extension_data_versions.scope_type, extension_data_versions.scope_id, extension_data_versions.version);
  const document = new Y.Doc();
  // Equal legacy data gets an equal bootstrap, so two upgraded devices do not duplicate text or list content.
  const imported = memoryDocumentState(document);
  const importing = { ...imported, migrationSeed: "journal-import" };
  const storage = createDocumentStorage({
    owner,
    store: { transaction: async (_owner, action) => action(importing) },
    assets: {
      verifyComplete: async () => {},
      read: async () => {
        throw new Error("Import does not read assets");
      },
      receive: async () => {
        throw new Error("Import does not receive assets");
      },
    },
  });
  if (records.length)
    await storage.records.commit({
      operationId: "journal-import",
      edits: records.map((record) => ({
        recordId: record.recordId,
        replace: record.value,
        asset: record.asset,
        deleted: record.deleted,
        ...(record.shared?.kind === "text" && {
          shared: [{ kind: "text.insert" as const, index: 0, text: record.shared.value }],
        }),
        ...(record.shared?.kind === "list" && {
          shared: [{ kind: "list.insert" as const, index: 0, values: record.shared.value }],
        }),
        ...(record.shared?.kind === "map" && {
          shared: Object.entries(record.shared.value).map(([key, value]) => ({ kind: "map.set" as const, key, value })),
        }),
      })),
    });
  for (const version of versions)
    await storage.setDataVersion(JSON.stringify([version.scope, version.id]), version.version);
  const update = Y.encodeStateAsUpdate(document);
  document.destroy();
  return update;
};
