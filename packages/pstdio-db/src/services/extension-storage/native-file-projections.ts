import { and, asc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import {
  native_document_file_projections as projections,
  storage_documents,
  owners as storageOwners,
} from "../../db/schemas.pg";
import { assertStorageOwnerAdmitted, storageOwnerAdmissionPending } from "../../db/storage-admission";

import { ensureStorageOwner, storageOwnerKey } from "./storage-owner-key";

interface Address {
  owner: StorageOwner;
  documentKey: string;
  projectionKey?: string;
}
const columns = ({ owner, documentKey, projectionKey = "handler" }: Address) => ({
  owner_id: storageOwnerKey(owner),
  document_key: documentKey,
  projection_key: projectionKey,
});
const where = (input: Address) => {
  const address = columns(input);
  return and(
    eq(projections.owner_id, address.owner_id),
    eq(projections.document_key, address.document_key),
    eq(projections.projection_key, address.projection_key),
  );
};

export const createNativeFileProjectionsDBService = (db: DbClient) => ({
  async copies({ owner, documentKey }: Address) {
    assertStorageOwnerAdmitted(db, owner);
    const rows = await db
      .select({ key: projections.projection_key })
      .from(projections)
      .where(and(eq(projections.owner_id, storageOwnerKey(owner)), eq(projections.document_key, documentKey)));
    return rows.map(({ key }) => key);
  },
  async initialize(input: Address & { state: Uint8Array | null }) {
    assertStorageOwnerAdmitted(db, input.owner);
    await db.transaction(async (tx) => {
      const ownerId = await ensureStorageOwner(tx, input.owner);
      await tx
        .insert(projections)
        .values({ ...columns(input), owner_id: ownerId, baseline: input.state })
        .onConflictDoNothing();
    });
  },
  async read(input: Address) {
    assertStorageOwnerAdmitted(db, input.owner);
    const [row] = await db
      .select({
        baseline: projections.baseline,
        pending: projections.pending,
        completedRevision: projections.completed_revision,
      })
      .from(projections)
      .where(where(input));
    return row;
  },
  async baseline(input: Address & { state: Uint8Array }) {
    assertStorageOwnerAdmitted(db, input.owner);
    await db.update(projections).set({ baseline: input.state }).where(where(input));
  },
  async begin(input: Address & { state: Uint8Array }) {
    assertStorageOwnerAdmitted(db, input.owner);
    await db.update(projections).set({ pending: input.state }).where(where(input));
  },
  async complete(input: Address & { state: Uint8Array; revision?: number }) {
    assertStorageOwnerAdmitted(db, input.owner);
    const rows = await db
      .update(projections)
      .set({
        baseline: input.state,
        pending: null,
        ...(input.revision !== undefined && { completed_revision: input.revision }),
      })
      .where(and(where(input), eq(projections.pending, input.state)))
      .returning({ key: projections.document_key });
    return rows.length > 0;
  },
  async cancel(input: Address & { state: Uint8Array }) {
    assertStorageOwnerAdmitted(db, input.owner);
    await db
      .update(projections)
      .set({ pending: null })
      .where(and(where(input), eq(projections.pending, input.state)));
  },
  async *pending(workbenchId?: string) {
    let cursor: string[] | undefined;
    while (true) {
      const rows = await db
        .select({
          workbenchId: storageOwners.project_id,
          extensionId: storageOwners.extension_id,
          documentKey: projections.document_key,
        })
        .from(projections)
        .innerJoin(storageOwners, eq(storageOwners.id, projections.owner_id))
        .leftJoin(
          storage_documents,
          and(
            eq(storage_documents.owner_id, projections.owner_id),
            eq(storage_documents.document_id, sql`'["native-markdown","' || ${projections.document_key} || '"]'`),
          ),
        )
        .where(
          and(
            or(isNotNull(projections.pending), gt(storage_documents.revision, projections.completed_revision)),
            eq(projections.projection_key, "handler"),
            workbenchId ? eq(storageOwners.project_id, workbenchId) : undefined,
            cursor
              ? sql`(${storageOwners.project_id}, ${storageOwners.extension_id}, ${projections.document_key}) > (${cursor[0]}, ${cursor[1]}, ${cursor[2]})`
              : undefined,
          ),
        )
        .orderBy(asc(storageOwners.project_id), asc(storageOwners.extension_id), asc(projections.document_key))
        .limit(100);
      for (const { workbenchId, extensionId, documentKey } of rows)
        if (!storageOwnerAdmissionPending(db, { workbenchId, extensionId }))
          yield { owner: { workbenchId, extensionId }, documentKey };
      if (rows.length < 100) return;
      const last = rows.at(-1)!;
      cursor = [last.workbenchId, last.extensionId, last.documentKey];
    }
  },
});
