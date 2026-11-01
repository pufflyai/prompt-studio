import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import type { StateEnvelope, UpdateEnvelope } from "pstdio-sync-contracts";
import type { RelayLimits } from "../limits";
import {
  admitWrite,
  rejection,
  removeRows,
  requireBlobs,
  requireQuota,
  type SyncCaller,
  SyncRejection,
} from "./accounts";
import type { connectRelay, RelayTransaction } from "./database";
import { type DocumentAddress, documentWhere, stateWhere, updateWhere } from "./document-address";
import { createDocumentReads, stateInfo } from "./document-reads";
import { syncDocuments, syncObjectDeletions, syncStates, syncUpdates } from "./document-schema";
import type { PayloadObjects } from "./payloads";

export type { DocumentAddress } from "./document-address";

/** Metadata-only notice that a document gained an update or a latest state. */
export interface DocumentChange extends DocumentAddress {
  created?: boolean;
  lastSequence: number;
  stateId: string | null;
}

export interface SyncDocumentsOptions {
  connection: ReturnType<typeof connectRelay>;
  payloads: PayloadObjects;
  limits: RelayLimits;
  changed: (change: DocumentChange) => void;
}

const pick = ({ projectKey, spaceOwner, documentId }: DocumentAddress) => ({ projectKey, spaceOwner, documentId });

const decode = (payload: string, limit: number) => {
  const bytes = Buffer.from(payload, "base64");
  if (bytes.byteLength > limit) throw rejection(413, "too-large");
  return bytes;
};

const lockDocument = async (transaction: RelayTransaction, address: DocumentAddress) => {
  await transaction
    .insert(syncDocuments)
    .values({ ...pick(address), lastSequence: 0, stateId: null })
    .onConflictDoNothing();
  const [document] = await transaction.select().from(syncDocuments).where(documentWhere(address)).for("update");
  // A document stays in the space it was created in. Another space cannot see or write it.
  if (document!.spaceOwner !== address.spaceOwner) throw rejection(404, "not-found");
  return document!;
};

/** Returns the current latest state, or refuses a new one that was not built on it (R18). */
const requireReplaceable = async (
  transaction: RelayTransaction,
  address: DocumentAddress,
  document: typeof syncDocuments.$inferSelect,
  envelope: StateEnvelope,
) => {
  const [current] = document.stateId
    ? await transaction.select().from(syncStates).where(stateWhere(address, document.stateId))
    : [];
  // A retry after a lost response finds its own state already current.
  if (current && current.stateId === envelope.stateId) return { current, retry: true };
  if (document.stateId !== envelope.baseStateId)
    throw new SyncRejection(409, { error: "stale-state", state: current ? stateInfo(current) : null });
  const [reused] = await transaction.select().from(syncStates).where(stateWhere(address, envelope.stateId));
  if (reused || envelope.through < (current?.through ?? 0) || envelope.through > document.lastSequence)
    throw rejection(400, "invalid-request");
  return { current, retry: false };
};

/**
 * Keeps only the state a new one replaces, and the updates after it, for the grace period (R20, R23).
 * Older copies are already inside that state, so they go now.
 */
const retire = async (
  transaction: RelayTransaction,
  address: DocumentAddress,
  current: typeof syncStates.$inferSelect | undefined,
  through: number,
  now: Date,
) => {
  if (current) {
    const document = and(eq(syncStates.projectKey, address.projectKey), eq(syncStates.documentId, address.documentId));
    await transaction.execute(removeRows("relay_sync_states", and(document, isNotNull(syncStates.replacedAt)), now));
    await transaction.execute(
      removeRows("relay_sync_updates", and(updateWhere(address), lte(syncUpdates.sequence, current.through)), now),
    );
    await transaction.update(syncStates).set({ replacedAt: now }).where(stateWhere(address, current.stateId));
  }
  await transaction
    .update(syncUpdates)
    .set({ coveredAt: now })
    .where(and(updateWhere(address), lte(syncUpdates.sequence, through), isNull(syncUpdates.coveredAt)));
};

export const createSyncDocuments = ({ connection, payloads, limits, changed }: SyncDocumentsOptions) => {
  // Cleanup deletes queued bytes only when no row points at them, so a commit whose reply was lost is safe.
  const forget = (objectKey: string) =>
    connection.run((db) => db.insert(syncObjectDeletions).values({ objectKey }).onConflictDoNothing()).catch(() => {});
  // Bytes go to object storage first, so a row only ever points at complete bytes.
  const store = async <T extends { stored: boolean }>(
    objectKey: string,
    bytes: Uint8Array,
    signal: AbortSignal | undefined,
    commit: (transaction: RelayTransaction) => Promise<T>,
  ) => {
    await payloads.put(objectKey, bytes, signal);
    let result: T;
    try {
      result = await connection.run((db) => db.transaction(commit), signal);
    } catch (error) {
      await forget(objectKey);
      throw error;
    }
    if (!result.stored) await forget(objectKey);
    return result;
  };

  return {
    ...createDocumentReads(connection, payloads, limits),

    /** Appends an encrypted update. An update ID the document already has is ignored (R27). */
    async appendUpdate(address: DocumentAddress, caller: SyncCaller, envelope: UpdateEnvelope, signal?: AbortSignal) {
      const bytes = decode(envelope.payload, limits.maxUpdateBytes);
      const now = new Date();
      const objectKey = payloads.key(address.projectKey, address.documentId, "updates");
      const result = await store(objectKey, bytes, signal, async (transaction) => {
        await admitWrite(transaction, address.projectKey, caller.accountId, now);
        const document = await lockDocument(transaction, address);
        const [duplicate] = await transaction
          .select()
          .from(syncUpdates)
          .where(and(updateWhere(address), eq(syncUpdates.updateId, envelope.updateId)));
        if (duplicate) return { stored: false, sequence: duplicate.sequence, stateId: document.stateId };
        await requireBlobs(transaction, address.projectKey, envelope.blobIds);
        await requireQuota(transaction, caller.accountId, bytes.byteLength, limits.accountQuotaBytes);
        const sequence = document.lastSequence + 1;
        await transaction.insert(syncUpdates).values({
          projectKey: address.projectKey,
          documentId: address.documentId,
          sequence,
          updateId: envelope.updateId,
          deviceId: caller.deviceId,
          byteLength: bytes.byteLength,
          objectKey,
          blobIds: envelope.blobIds,
          createdAt: now,
        });
        await transaction.update(syncDocuments).set({ lastSequence: sequence }).where(documentWhere(address));
        return {
          stored: true,
          sequence,
          stateId: document.stateId,
          created: document.lastSequence === 0 && document.stateId === null,
        };
      });
      if (result.stored)
        changed({ ...pick(address), lastSequence: result.sequence, stateId: result.stateId, created: result.created });
      return { sequence: result.sequence, duplicate: !result.stored };
    },

    /** Replaces the latest state only when the client built it on the current one (R18). */
    async replaceState(address: DocumentAddress, caller: SyncCaller, envelope: StateEnvelope, signal?: AbortSignal) {
      const bytes = decode(envelope.payload, limits.maxStateBytes);
      decode(envelope.summary, limits.maxSummaryBytes);
      const now = new Date();
      const objectKey = payloads.key(address.projectKey, address.documentId, "states");
      const result = await store(objectKey, bytes, signal, async (transaction) => {
        await admitWrite(transaction, address.projectKey, caller.accountId, now);
        const document = await lockDocument(transaction, address);
        const { current, retry } = await requireReplaceable(transaction, address, document, envelope);
        if (retry) return { stored: false, state: current!, document };
        await requireBlobs(transaction, address.projectKey, envelope.blobIds);
        const [state] = await transaction
          .insert(syncStates)
          .values({
            projectKey: address.projectKey,
            documentId: address.documentId,
            stateId: envelope.stateId,
            baseStateId: envelope.baseStateId,
            through: envelope.through,
            byteLength: bytes.byteLength,
            summary: envelope.summary,
            objectKey,
            blobIds: envelope.blobIds,
            deviceId: caller.deviceId,
            createdAt: now,
          })
          .returning();
        await retire(transaction, address, current, envelope.through, now);
        // Checked after retiring, so a state that frees space is accepted at the quota.
        await requireQuota(transaction, caller.accountId, 0, limits.accountQuotaBytes);
        await transaction.update(syncDocuments).set({ stateId: envelope.stateId }).where(documentWhere(address));
        return { stored: true, state: state!, document };
      });
      if (result.stored)
        changed({
          ...pick(address),
          lastSequence: result.document.lastSequence,
          stateId: result.state.stateId,
          created: result.document.lastSequence === 0 && result.document.stateId === null,
        });
      return { state: stateInfo(result.state) };
    },
  };
};
