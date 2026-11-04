import { and, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedAdmission, OrderedDecision, OrderedOperation } from "pstdio-sync/records";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import {
  storage_ordered_operations as operations,
  storage_ordered_owners as owners,
  storage_ordered_receipts as receipts,
  storage_ordered_touches as touches,
} from "../../db/schemas.pg";
import { createOrderedCanonical } from "./ordered-canonical";
import {
  decodeOrderedJson as decode,
  encodeOrderedJson as encode,
  orderedOwnerWhere as ownerWhere,
  type OrderedTransaction as Transaction,
} from "./ordered-sql";
import { lockRecordOwner } from "./record-changes";

const identityError = () => new Error("Operation identity reused with changed payload");
const verifyOperation = async (operation: OrderedOperation) => {
  const { fingerprint: identity, ...envelope } = operation;
  if ((await fingerprint(envelope as unknown as Json)) !== identity) throw identityError();
};

const local = (row: typeof operations.$inferSelect) =>
  row.envelope
    ? {
        sequence: row.local_sequence,
        operation: decode<OrderedOperation>(row.envelope),
        requestFingerprint: row.request_fingerprint,
        admission: row.admission ? decode<OrderedAdmission>(row.admission) : null,
        delivered: row.delivered,
      }
    : undefined;

/** All calls run inside the same project/owner lock as their projection and relay cursor. */
const createJournal = (tx: Transaction, owner: StorageOwner) => {
  const address = { workbench_id: owner.workbenchId, extension_id: owner.extensionId };
  const operationWhere = (id: string) => and(ownerWhere(operations, owner), eq(operations.operation_id, id));
  const operation = async (id: string) => {
    const [row] = await tx.select().from(operations).where(operationWhere(id));
    return row;
  };
  const bind = async (id: string, identity: string) => {
    await tx
      .insert(operations)
      .values({ ...address, operation_id: id, fingerprint: identity })
      .onConflictDoNothing();
    const row = (await operation(id))!;
    if (row.fingerprint !== identity) throw identityError();
    return row;
  };
  const cachedDecision = async (id: string, epoch: string) => {
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
  return {
    cachedDecision,
    async localOperation(id: string) {
      const row = await operation(id);
      return row ? local(row) : undefined;
    },
    async queue(input: OrderedOperation, requestFingerprint: string) {
      await verifyOperation(input);
      const row = await bind(input.operationId, input.fingerprint);
      if (row.envelope) {
        if (row.request_fingerprint !== requestFingerprint) throw identityError();
        return local(row)!;
      }
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
      await verifyOperation(admission.operation);
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
    async delivered(ids: string[], epoch: string) {
      for (let offset = 0; offset < ids.length; offset += 1_000)
        await tx
          .update(operations)
          .set({ delivered: true })
          .where(
            and(
              pendingWhere(),
              eq(operations.admission_epoch, epoch),
              inArray(operations.operation_id, ids.slice(offset, offset + 1_000)),
            ),
          );
    },
    async recordDecision(decision: OrderedDecision, admissionFingerprint: string) {
      const row = await bind(decision.operationId, decision.fingerprint);
      const where = and(
        ownerWhere(receipts, owner),
        eq(receipts.epoch, decision.epoch),
        eq(receipts.operation_id, decision.operationId),
      );
      const [previous] = await tx.select().from(receipts).where(where);
      if (previous && (previous.state !== decision.state || previous.admission_fingerprint !== admissionFingerprint))
        throw new Error("An ordered decision is immutable");
      if (row.admission_epoch === decision.epoch && row.admission_fingerprint !== admissionFingerprint)
        throw new Error("The decision does not match the admitted identity");
      await tx
        .insert(receipts)
        .values({
          ...address,
          epoch: decision.epoch,
          operation_id: decision.operationId,
          state: decision.state,
          admission_fingerprint: admissionFingerprint,
        })
        .onConflictDoNothing();
      // Historical decisions remain queryable but never settle a wrapper admitted in another epoch.
      if (row.envelope && row.admission_epoch === decision.epoch) {
        await tx.update(operations).set({ settled_epoch: decision.epoch }).where(operationWhere(decision.operationId));
        await tx.delete(touches).where(and(ownerWhere(touches, owner), eq(touches.operation_id, decision.operationId)));
      }
    },
    async outcome(id: string) {
      const row = await operation(id);
      return row?.settled_epoch ? cachedDecision(id, row.settled_epoch) : undefined;
    },
    ...createOrderedCanonical(tx, owner),
  };
};

/** The journal exists before a connection does. Projection/cursor writes share this transaction. */
export const withOrderedOwner = <T>(
  db: DbClient,
  owner: StorageOwner,
  run: (journal: ReturnType<typeof createJournal>, tx: Transaction, created: boolean) => Promise<T>,
) =>
  db.transaction(async (tx) => {
    await lockRecordOwner(tx, owner);
    const created = await tx
      .insert(owners)
      .values({ workbench_id: owner.workbenchId, extension_id: owner.extensionId })
      .onConflictDoNothing()
      .returning({ id: owners.workbench_id });
    return run(createJournal(tx, owner), tx, created.length > 0);
  });
