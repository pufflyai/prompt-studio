import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import {
  type OrderedAdmission,
  type OrderedDecision,
  type OrderedOperation,
  validateOrderedNativeOperation,
  verifyOrderedAdmission,
  verifyOrderedOperation,
} from "pstdio-sync/records";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_ordered_operations as operations,
  storage_ordered_receipts as receipts,
  storage_ordered_touches as touches,
} from "../../db/schemas.pg";
import {
  createOrderedAuthorship,
  orderedLocalOperation as local,
  retryOrderedLocalOperation,
} from "./ordered-authorship";
import { createOrderedCanonical } from "./ordered-canonical";
import { ensureOrderedOwner } from "./ordered-conversion";
import { createOrderedDependencyCache } from "./ordered-dependency-cache";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { fenceOrderedNativeText, forgetOrderedTextGeneration } from "./ordered-native-recovery";
import { createOrderedReceiptCache } from "./ordered-receipts-cache";
import {
  decodeOrderedJson as decode,
  encodeOrderedJson as encode,
  orderedOwnerWhere as ownerWhere,
  type OrderedTransaction as Transaction,
} from "./ordered-sql";
import { lockRecordOwner } from "./record-changes";

const identityError = () => new Error("Operation identity reused with changed payload");

const bindOperationIdentity = async (tx: Transaction, owner: StorageOwner, id: string, identity: string) => {
  const [row] = await tx
    .insert(operations)
    .values({
      workbench_id: owner.workbenchId,
      extension_id: owner.extensionId,
      operation_id: id,
      fingerprint: identity,
    })
    .onConflictDoUpdate({
      target: [operations.workbench_id, operations.extension_id, operations.operation_id],
      // Retain the original identity and payload while returning its locked row
      // in this statement; every admission otherwise repeats a separate lookup.
      set: { fingerprint: operations.fingerprint },
    })
    .returning();
  if (row!.fingerprint !== identity) throw identityError();
  return row!;
};

/** All calls run inside the same project/owner lock as their projection and relay cursor. */
export const createOrderedJournal = (tx: Transaction, owner: StorageOwner) => {
  const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId };
  const operationWhere = (id: string) => and(ownerWhere(operations, owner), eq(operations.operation_id, id));
  const operation = async (id: string) => {
    const [row] = await tx.select().from(operations).where(operationWhere(id));
    return row;
  };
  const bind = (id: string, identity: string) => bindOperationIdentity(tx, owner, id, identity);
  // Receipts are immutable, so a found receipt stays valid for this owner transaction.
  const held = new Map<string, Awaited<ReturnType<typeof readDecision>>>();
  const cachedDecision = async (id: string, epoch: string) => {
    const key = JSON.stringify([id, epoch]);
    if (held.has(key)) return held.get(key);
    const row = await readDecision(id, epoch);
    if (row) held.set(key, row);
    return row;
  };
  const readDecision = async (id: string, epoch: string) => {
    const [row] = await tx
      .select({
        operationId: receipts.operation_id,
        epoch: receipts.epoch,
        state: receipts.state,
        fingerprint: operations.fingerprint,
      })
      .from(receipts)
      .innerJoin(
        operations,
        and(
          eq(operations.workbench_id, receipts.workbench_id),
          eq(operations.extension_id, receipts.extension_id),
          eq(operations.operation_id, receipts.operation_id),
        ),
      )
      .where(and(ownerWhere(receipts, owner), eq(receipts.operation_id, id), eq(receipts.epoch, epoch)));
    return row;
  };
  const pendingWhere = () =>
    and(ownerWhere(operations, owner), isNotNull(operations.envelope), isNull(operations.settled_epoch));
  const dependencies = createOrderedDependencyCache(tx, owner, cachedDecision);
  return {
    knownDependency: dependencies.known,
    cachedDecision,
    bindIdentity: bind,
    ...createOrderedAuthorship(tx, owner, operation),
    async queue(input: OrderedOperation, requestFingerprint: string) {
      input = await verifyOrderedOperation(input);
      if (isOrderedNativeRequest(requestFingerprint)) {
        validateOrderedNativeOperation(input);
        const previous = await operation(input.operationId);
        if (previous && !isOrderedNativeRequest(previous.request_fingerprint)) throw identityError();
      }
      const row = await bind(input.operationId, input.fingerprint);
      if (row.envelope || row.settled_epoch) return retryOrderedLocalOperation(row, input, requestFingerprint);
      const [saved] = await tx
        .update(operations)
        .set({
          envelope: encode(input),
          request_fingerprint: requestFingerprint,
          local_sequence: sql`nextval(pg_get_serial_sequence('storage_ordered_operations', 'local_sequence'))`,
        })
        .where(operationWhere(input.operationId))
        .returning();
      for (let offset = 0; offset < input.edits.length; offset += 1_000)
        await tx
          .insert(touches)
          .values(
            input.edits.slice(offset, offset + 1_000).map((edit) => ({
              ...address,
              operation_id: input.operationId,
              record_id: edit.recordId,
              local_sequence: saved!.local_sequence,
            })),
          )
          .onConflictDoNothing();
      return local(saved!)!;
    },
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
        // Seek each record's membership index before deduplicating groups. Read payloads only
        // after the global page is known, so a group touching many records is never copied per join row.
        const result = await tx.execute(sql`
          SELECT DISTINCT picked.operation_id, picked.local_sequence
          FROM jsonb_array_elements_text(${JSON.stringify(recordIds.slice(offset, offset + 1_000))}::jsonb) requested(record_id)
          CROSS JOIN LATERAL (
            SELECT membership.operation_id, membership.local_sequence FROM storage_ordered_touches membership
            WHERE membership.workbench_id = ${owner.workbenchId} AND membership.extension_id = ${owner.extensionId}
              AND membership.record_id = requested.record_id AND membership.local_sequence > ${options.after ?? 0}
            ORDER BY membership.local_sequence LIMIT ${limit}
          ) picked ORDER BY picked.local_sequence LIMIT ${limit}
        `);
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
    async admit(admission: OrderedAdmission) {
      admission = await verifyOrderedAdmission(admission);
      const row = await operation(admission.operation.operationId);
      if (!row?.envelope || row.fingerprint !== admission.operation.fingerprint) throw identityError();
      if (row.settled_epoch) throw new Error("A settled save cannot enter another order");
      const identity = await fingerprint(admission as unknown as Json);
      if (row.admission_epoch === admission.epoch && row.admission_fingerprint !== identity)
        throw new Error("An admission is immutable within its order epoch");
      if (row.admission_epoch === admission.epoch) return;
      await tx
        .update(operations)
        .set({
          admission_epoch: admission.epoch,
          admission: encode(admission),
          admission_fingerprint: identity,
          delivered: false,
        })
        .where(operationWhere(row.operation_id));
    },
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
      const [retained] = await tx
        .insert(receipts)
        .values({
          ...address,
          epoch: decision.epoch,
          operation_id: decision.operationId,
          state: decision.state,
          admission_fingerprint: admissionFingerprint,
          indexed: options.indexed ?? false,
        })
        .onConflictDoUpdate({
          target: [receipts.workbench_id, receipts.extension_id, receipts.epoch, receipts.operation_id],
          // Return the retained decision without replacing its immutable contents.
          set: { indexed: options.indexed ? true : receipts.indexed },
        })
        .returning({ state: receipts.state, admissionFingerprint: receipts.admission_fingerprint });
      if (retained!.state !== decision.state || retained!.admissionFingerprint !== admissionFingerprint)
        throw new Error("An ordered decision is immutable");
      await dependencies.remember(decision);
      // Historical decisions remain queryable but never settle a wrapper admitted in another epoch.
      if (row.envelope && row.admission_epoch === decision.epoch && !row.settled_epoch) {
        if (decision.state === "refused")
          await fenceOrderedNativeText(tx, owner, decode<OrderedOperation>(row.envelope));
        await tx.update(operations).set({ settled_epoch: decision.epoch }).where(operationWhere(decision.operationId));
        await tx.delete(touches).where(and(ownerWhere(touches, owner), eq(touches.operation_id, decision.operationId)));
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
      await tx.update(operations).set({ settled_epoch: decision.epoch }).where(operationWhere(decision.operationId));
      await tx.delete(touches).where(and(ownerWhere(touches, owner), eq(touches.operation_id, decision.operationId)));
      await forgetOrderedTextGeneration(tx, owner, decision.operationId);
    },
    ...createOrderedCanonical(tx, owner),
    ...createOrderedReceiptCache(tx, owner),
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
      return run(createOrderedJournal(tx, owner), tx);
    }),
  );

export type OrderedJournal = ReturnType<typeof createOrderedJournal>;
