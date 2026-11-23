import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  type OrderedAdmission,
  type OrderedDecision,
  type OrderedOperation,
  validateOrderedNativeOperation,
  verifyOrderedOperation,
} from "pstdio-sync/records";
import type { DbClient } from "../../db/connection.pglite";
import { storage_ordered_operations as operations } from "../../db/schemas.pg";
import { admitOrderedOperation } from "./ordered-admission";
import {
  createOrderedAuthorship,
  orderedLocalOperation as local,
  retryOrderedLocalOperation,
} from "./ordered-authorship";
import { createOrderedCanonical } from "./ordered-canonical";
import { createOrderedDependencyCache } from "./ordered-dependency-cache";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { fenceOrderedNativeText, forgetOrderedTextGeneration } from "./ordered-native-recovery";
import { ensureOrderedOwner } from "./ordered-owner";
import { operationIndexedAt, operationReceipt, operationReceiptsIndexed } from "./ordered-receipt-values";
import { createOrderedReceiptCache } from "./ordered-receipts-cache";
import { finishOrderedRecordWrites } from "./ordered-record-publication";
import { readOrderedSaveOutcome } from "./ordered-save-outcome";
import {
  decodeOrderedJson as decode,
  encodeOrderedJson as encode,
  orderedAddress,
  orderedOwnerWhere as ownerWhere,
  type OrderedTransaction as Transaction,
} from "./ordered-sql";
import { lockRecordOwner } from "./record-changes";
import { hasRetainedOperations, type RetainedOperation, readRetainedOperation } from "./retained-operations";
import { storageOwnerKey } from "./storage-owner-key";

const identityError = () => new Error("Operation identity reused with changed payload");

const bindOperationIdentity = async (
  tx: Transaction,
  owner: StorageOwner,
  id: string,
  identity: string,
  retained: (id: string) => Promise<RetainedOperation | undefined>,
) => {
  const read = () =>
    tx
      .select()
      .from(operations)
      .where(and(ownerWhere(operations, owner), eq(operations.operation_id, id)));
  // Most decisions bind an already authored operation. Read its current row
  // without rewriting an immutable identity or consuming another queue sequence.
  let [row] = await read();
  if (!row)
    [row] = await tx
      .insert(operations)
      .values({
        ...orderedAddress(owner),
        operation_id: id,
        fingerprint: identity,
      })
      .onConflictDoNothing({ target: [operations.owner_id, operations.operation_id] })
      .returning();
  // A conflicting insertion can become visible only after the INSERT snapshot.
  if (!row) [row] = await read();
  if (!row) throw new Error("An ordered operation reservation is missing");
  if (row!.fingerprint !== identity) throw identityError();
  if (!row!.request_fingerprint && !row!.envelope && !Object.keys(row!.receipt).length) {
    const saved = await retained(id);
    if (saved) {
      if (saved.fingerprint !== identity) throw identityError();
      const [restored] = await tx
        .update(operations)
        .set({ ...saved, owner_id: row!.owner_id })
        .where(and(ownerWhere(operations, owner), eq(operations.operation_id, id)))
        .returning();
      return restored!;
    }
  }
  return row!;
};

const queueOrderedOperation = async (
  tx: Transaction,
  owner: StorageOwner,
  input: OrderedOperation,
  requestFingerprint: string,
  operation: (id: string) => Promise<typeof operations.$inferSelect | undefined>,
  retained: (id: string) => Promise<RetainedOperation | undefined>,
) => {
  input = await verifyOrderedOperation(input);
  if (await retained(input.operationId)) {
    const previous = await bindOperationIdentity(tx, owner, input.operationId, input.fingerprint, retained);
    if (previous.request_fingerprint) return retryOrderedLocalOperation(previous, input, requestFingerprint);
  }
  if (isOrderedNativeRequest(requestFingerprint)) {
    validateOrderedNativeOperation(input);
    const previous = await operation(input.operationId);
    if (previous && !isOrderedNativeRequest(previous.request_fingerprint)) throw identityError();
  }
  const [saved] = await tx
    .insert(operations)
    .values({
      ...orderedAddress(owner),
      operation_id: input.operationId,
      fingerprint: input.fingerprint,
      envelope: encode(input),
      request_fingerprint: requestFingerprint,
      touches: [...new Set(input.edits.map((edit) => edit.recordId))],
    })
    .onConflictDoUpdate({
      target: [operations.owner_id, operations.operation_id],
      // A receipt can reserve the identity before authorship. Only that empty,
      // matching reservation may acquire an envelope and a fresh queue position.
      set: {
        envelope: sql`excluded.envelope`,
        request_fingerprint: sql`excluded.request_fingerprint`,
        local_sequence: sql`excluded.local_sequence`,
        touches: sql`excluded.touches`,
      },
      setWhere: and(
        eq(operations.fingerprint, input.fingerprint),
        isNull(operations.envelope),
        isNull(operations.settled_epoch),
      ),
    })
    .returning();
  if (!saved) {
    const row = (await operation(input.operationId))!;
    if (row.fingerprint !== input.fingerprint) throw identityError();
    return retryOrderedLocalOperation(row, input, requestFingerprint);
  }
  return local(saved!)!;
};

/** All calls run inside the same project/owner lock as their projection and relay cursor. */
export const createOrderedJournal = (tx: Transaction, owner: StorageOwner) => {
  const operationWhere = (id: string) => and(ownerWhere(operations, owner), eq(operations.operation_id, id));
  const cold = new Map<string, Promise<RetainedOperation | undefined>>();
  // Journal methods never write private authorship pages. Maintenance and backup
  // restoration use a fresh journal, so absence stays valid only in this lifetime.
  let retainedRoot: Promise<boolean> | undefined;
  const readCold = async (id: string) => {
    retainedRoot ??= hasRetainedOperations(tx, owner);
    if (await retainedRoot) return readRetainedOperation(tx, owner, id);
  };
  const retained = (id: string) => {
    if (!cold.has(id)) cold.set(id, readCold(id));
    return cold.get(id)!;
  };
  const receipts = createOrderedReceiptCache(tx, owner, retained);
  const operation = async (id: string) => {
    const [row] = await tx.select().from(operations).where(operationWhere(id));
    return row ?? retained(id);
  };
  const bind = (id: string, identity: string) => bindOperationIdentity(tx, owner, id, identity, retained);
  // Receipts are immutable, so a found receipt stays valid for this owner transaction.
  const held = new Map<string, Awaited<ReturnType<typeof readDecision>>>();
  const cachedDecision = async (id: string, epoch: string) => {
    const key = JSON.stringify([id, epoch]);
    if (held.has(key)) return held.get(key);
    const row = await readDecision(id, epoch);
    if (row) held.set(key, row);
    return row;
  };
  const readDecision = async (id: string, epoch: string) => (await receipts.cachedReceipt(id, epoch))?.decision;
  const pendingWhere = () =>
    and(ownerWhere(operations, owner), isNotNull(operations.envelope), isNull(operations.settled_epoch));
  const dependencies = createOrderedDependencyCache(tx, owner, cachedDecision, operation);
  return {
    authoredOutcome: (id: string) => readOrderedSaveOutcome(tx, owner, id),
    knownDependency: dependencies.known,
    cachedDecision,
    bindIdentity: bind,
    ...createOrderedAuthorship(tx, owner, operation),
    queue: (input: OrderedOperation, requestFingerprint: string) =>
      queueOrderedOperation(tx, owner, input, requestFingerprint, operation, retained),
    async pending(options: { after?: number; limit?: number } = {}) {
      const rows = await tx
        .select()
        .from(operations)
        .where(and(pendingWhere(), gt(operations.local_sequence, options.after ?? 0)))
        .orderBy(operations.local_sequence)
        .limit(options.limit ?? 100);
      return rows.map((row) => local(row)!);
    },
    async pendingFor(recordIds: string[], options: { after?: number; limit?: number } = {}) {
      if (!recordIds.length) return [];
      // Local settlement retires every touch. Probe the smaller pending-operation index
      // before seeking thousands of absent memberships through recently deleted rows.
      const [pending] = await tx
        .select({ id: operations.operation_id })
        .from(operations)
        .where(pendingWhere())
        .limit(1);
      if (!pending) return [];
      const limit = options.limit ?? 100;
      let selected = new Map<string, number>();
      for (let offset = 0; offset < recordIds.length; offset += 1_000) {
        // The partial GIN index probes memberships without copying pending envelopes.
        const result = await tx.execute(sql`
          SELECT operation_id,local_sequence FROM operations
          WHERE owner_id=${storageOwnerKey(owner)} AND envelope IS NOT NULL AND settled_epoch IS NULL
            AND touches && ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(recordIds.slice(offset, offset + 1_000))}::jsonb))
            AND local_sequence>${options.after ?? 0}
          ORDER BY local_sequence LIMIT ${limit}`);
        for (const row of result.rows as { operation_id: string; local_sequence: number | string }[])
          selected.set(row.operation_id, Number(row.local_sequence));
        selected = new Map([...selected].sort((a, b) => a[1] - b[1]).slice(0, limit));
      }
      if (!selected.size) return [];
      const rows = await tx
        .select()
        .from(operations)
        .where(and(pendingWhere(), inArray(operations.operation_id, [...selected.keys()])))
        .orderBy(operations.local_sequence);
      return rows.map((row) => local(row)!);
    },
    admit: (admission: OrderedAdmission) => admitOrderedOperation(tx, owner, admission),
    async deliveredSequences(sequences: number[], epoch: string) {
      for (let offset = 0; offset < sequences.length; offset += 1_000)
        await tx
          .update(operations)
          .set({ delivered: true })
          .where(
            and(
              pendingWhere(),
              eq(operations.admission_epoch, epoch),
              inArray(operations.local_sequence, sequences.slice(offset, offset + 1_000)),
            ),
          );
    },
    async recordDecision(decision: OrderedDecision, admissionFingerprint: string, options: { indexed?: boolean } = {}) {
      const row = await bind(decision.operationId, decision.fingerprint);
      if (isOrderedNativeRequest(row.request_fingerprint)) throw identityError();
      if (row.admission_epoch === decision.epoch && row.admission_fingerprint !== admissionFingerprint)
        throw new Error("The decision does not match the admitted identity");
      const retained = operationReceipt(row.receipt, decision.epoch);
      if (retained && (retained.state !== decision.state || retained.admissionFingerprint !== admissionFingerprint))
        throw new Error("An ordered decision is immutable");
      const receipt = Object.fromEntries([
        ...Object.entries(row.receipt),
        [
          decision.epoch,
          {
            state: decision.state,
            admissionFingerprint,
            indexed: !!retained?.indexed || !!options.indexed,
            ...(retained?.indexedAt || options.indexed
              ? { indexedAt: retained?.indexedAt ?? new Date().toISOString() }
              : {}),
          },
        ],
      ]);
      await tx
        .update(operations)
        .set({
          receipt,
          receipt_epoch: decision.epoch,
          receipt_indexed: operationReceiptsIndexed(receipt),
          indexed_at: operationIndexedAt(receipt),
        })
        .where(operationWhere(decision.operationId));
      await dependencies.remember(decision);
      // Historical decisions remain queryable but never settle a wrapper admitted in another epoch.
      if (row.envelope && row.admission_epoch === decision.epoch && !row.settled_epoch) {
        if (decision.state === "refused")
          await fenceOrderedNativeText(tx, owner, decode<OrderedOperation>(row.envelope));
        await tx
          .update(operations)
          .set({ settled_epoch: decision.epoch, touches: [], envelope: null, admission: null })
          .where(operationWhere(decision.operationId));
        await forgetOrderedTextGeneration(tx, owner, decision.operationId);
      }
    },
    async outcome(id: string) {
      const row = await operation(id);
      return row?.settled_epoch ? cachedDecision(id, row.settled_epoch) : undefined;
    },
    /** Native text structs are idempotent; only local delivery bookkeeping is retained until ordering. */
    async completeNative(input: OrderedOperation, state: "accepted" | "refused") {
      const row = await operation(input.operationId);
      if (!row?.envelope || !isOrderedNativeRequest(row.request_fingerprint)) return;
      if (row.fingerprint !== input.fingerprint) throw identityError();
      if (state === "refused") await fenceOrderedNativeText(tx, owner, decode<OrderedOperation>(row.envelope));
      await forgetOrderedTextGeneration(tx, owner, input.operationId);
      await tx.delete(operations).where(operationWhere(input.operationId));
    },
    /** Checkpoint reconciliation explicitly selects a known exact receipt before any readmission. */
    async settleKnown(decision: OrderedDecision) {
      dependencies.forget(decision.operationId);
      const row = await operation(decision.operationId);
      const known = await cachedDecision(decision.operationId, decision.epoch);
      if (!row?.envelope || row.settled_epoch) return;
      if (!known || known.fingerprint !== decision.fingerprint || known.state !== decision.state)
        throw new Error("Settlement requires the exact saved receipt");
      if (decision.state === "refused") await fenceOrderedNativeText(tx, owner, decode<OrderedOperation>(row.envelope));
      await tx
        .update(operations)
        .set({ settled_epoch: decision.epoch, touches: [], envelope: null, admission: null })
        .where(operationWhere(decision.operationId));
      await forgetOrderedTextGeneration(tx, owner, decision.operationId);
    },
    ...createOrderedCanonical(tx, owner),
    ...receipts,
  };
};

/** The journal exists before a connection does. Projection/cursor writes share this transaction. */
export const withOrderedOwner = <T>(
  db: DbClient,
  owner: StorageOwner,
  run: (journal: OrderedJournal, tx: Transaction) => Promise<T>,
) =>
  ensureOrderedOwner(db, owner).then(() =>
    db.transaction(async (tx) => {
      await lockRecordOwner(tx, owner);
      const result = await run(createOrderedJournal(tx, owner), tx);
      await finishOrderedRecordWrites(tx, owner);
      return result;
    }),
  );

export type OrderedJournal = ReturnType<typeof createOrderedJournal>;
