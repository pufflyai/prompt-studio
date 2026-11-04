import { and, count, eq, gte, inArray, lt } from "drizzle-orm";
import type { LogDelivery, LogReceivedBatch, LogStreamStore } from "pstdio-sync/logs";
import { canonicalJson, fingerprint, type Json, type StorageLogEntry } from "pstdio-sync-contracts";
import type { DbClient } from "../../db/connection.pglite";
import { storage_log_entries as entries, storage_log_streams as streams } from "../../db/schemas.pg";
import { orderedLogPendingThrough, readOrderedLogPending } from "./ordered-log-pending";
import { lookupOrderedLogMetadata, planOrderedLog } from "./ordered-log-plan";
import { readOrderedLog } from "./ordered-log-read";
import { orderedLogSnapshotPage } from "./ordered-log-snapshot";
import {
  decodeLogPayload,
  encodeLogPayload,
  type LogTransaction,
  lockLogStream,
  logAddress,
  logAddressKey,
  logCutoff,
  logWhere,
  type OrderedLogAddress,
} from "./ordered-log-sql";
import { orderedLogStatistics } from "./ordered-log-statistics";

const identityError = () => new Error("Log entry identity reused with changed content");
const validateEntry = (entry: StorageLogEntry) => {
  if (!entry.id || !entry.writerId || !Number.isFinite(Date.parse(entry.createdAt)))
    throw new Error("Invalid log entry");
  canonicalJson(entry.value);
};

const validateLogAddress = (input: OrderedLogAddress) => {
  if (
    !input.name ||
    !input.stream ||
    !input.writerId ||
    (input.keep && (!Number.isFinite(input.keep.days) || input.keep.days <= 0))
  )
    throw new Error("Invalid log declaration");
};
const validateLogPosition = (sequence: number) => {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error("Invalid log relay position");
};
const readLogStatus = async (db: DbClient, input: OrderedLogAddress) => {
  const [row] = await db.select().from(streams).where(logWhere(streams, input));
  return {
    head: row?.head ?? 0,
    completeThrough: row?.complete_through ?? 0,
    stateId: row?.state_id ?? null,
    through: row?.through ?? 0,
  };
};
const pruneLogEntries = async (tx: Pick<DbClient, "delete">, input: OrderedLogAddress) => {
  if (!input.keep) return 0;
  const result = await tx
    .delete(entries)
    .where(and(logWhere(entries, input), lt(entries.created_at, logCutoff(input))));
  return result.affectedRows ?? 0;
};
export const createOrderedLogStore = (db: DbClient, input: OrderedLogAddress) => {
  validateLogAddress(input);
  const statistics = orderedLogStatistics(db);
  const listeners = new Set<() => void>();
  const changed = () => {
    input.changed?.();
    for (const listener of listeners) listener();
  };
  const rowWhere = (id: string) => and(logWhere(entries, input), eq(entries.entry_id, id));
  const entryRow = async (tx: Pick<DbClient, "select">, id: string) =>
    (await tx.select().from(entries).where(rowWhere(id)))[0];
  const write = async (
    entry: StorageLogEntry,
    tx: LogTransaction,
    local: boolean,
    sequence?: number,
    index?: number,
  ) => {
    validateEntry(entry);
    const identity = await fingerprint(entry as unknown as Json);
    const previous = await entryRow(tx, entry.id);
    if (previous) {
      if (previous.fingerprint !== identity) throw identityError();
      if (
        sequence !== undefined &&
        (previous.relay_sequence === null ||
          sequence < previous.relay_sequence ||
          (sequence === previous.relay_sequence && index! < previous.relay_index!))
      ) {
        await tx
          .update(entries)
          .set({ relay_sequence: sequence, relay_index: index, envelope: null })
          .where(rowWhere(entry.id));
        return 1;
      }
      return 0;
    }
    await tx.insert(entries).values({
      ...logAddress(input),
      entry_id: entry.id,
      writer_id: entry.writerId,
      created_at: Date.parse(entry.createdAt),
      fingerprint: identity,
      entry: await encodeLogPayload(input, entry),
      local,
      relay_sequence: sequence,
      relay_index: index,
    });
    return 1;
  };
  const completeBatch = async (tx: LogTransaction, batch: LogReceivedBatch) => {
    if (batch.expected) {
      if (!batch.expected.length) return true;
      const rows = await tx
        .select()
        .from(entries)
        .where(
          and(
            logWhere(entries, input),
            inArray(
              entries.entry_id,
              batch.expected.map((entry) => entry.id),
            ),
          ),
        );
      const known = new Map(rows.map((row) => [row.entry_id, row]));
      return batch.expected.every((expected) => {
        const row = known.get(expected.id);
        if (row && row.fingerprint !== expected.fingerprint) throw identityError();
        return row && row.relay_sequence !== null;
      });
    }
    const [cached] = await tx
      .select({ count: count() })
      .from(entries)
      .where(
        and(
          logWhere(entries, input),
          eq(entries.relay_sequence, batch.sequence),
          input.keep && gte(entries.created_at, logCutoff(input)),
        ),
      );
    return cached!.count >= (batch.retainedCount ?? batch.entries.length);
  };
  const receiveBatches = async (tx: LogTransaction, batches: LogReceivedBatch[], complete: number) => {
    let changed = 0;
    for (const batch of batches) {
      validateLogPosition(batch.sequence);
      if (batch.skipBefore !== undefined && complete === batch.skipBefore) complete = batch.sequence - 1;
      for (const [index, entry] of batch.entries.entries())
        if (entry) changed += await write(entry, tx, false, batch.sequence, index);
      if (batch.sequence === complete + 1 && (await completeBatch(tx, batch))) complete = batch.sequence;
    }
    return { complete, changed };
  };
  return {
    address: logAddressKey(input),
    cutoff: () => logCutoff(input),
    async append(value: Json, options: { id?: string } = {}) {
      const owned = structuredClone(value);
      canonicalJson(owned);
      const id = options.id ?? crypto.randomUUID();
      const result = await db.transaction(async (tx) => {
        await lockLogStream(tx, input);
        const previous = await entryRow(tx, id);
        if (previous) {
          const entry = await decodeLogPayload<StorageLogEntry>(input, previous.entry);
          if (entry.writerId !== input.writerId || canonicalJson(entry.value) !== canonicalJson(owned))
            throw identityError();
          return { entry, changed: 0 };
        }
        const entry = {
          id,
          writerId: input.writerId,
          createdAt: new Date((input.now ?? Date.now)()).toISOString(),
          value: owned,
        };
        const changed = (await write(entry, tx, true)) + (await pruneLogEntries(tx, input));
        return { entry, changed };
      });
      if (result.changed) statistics.record(result.changed);
      changed();
      return result.entry;
    },
    read: (options = {}) => {
      const owned = structuredClone(options);
      return db.transaction((tx) => readOrderedLog(tx, input, owned), {
        isolationLevel: "repeatable read",
        accessMode: "read only",
      });
    },
    pendingThrough: () => orderedLogPendingThrough(db, input),
    pending: (limit: number, through?: number) => readOrderedLogPending(db, input, limit, through),
    plan: (options = {}) => planOrderedLog(db, input, options),
    lookupMetadata: (ids: readonly string[]) => lookupOrderedLogMetadata(db, input, ids),
    async prepare(id: string, delivery: LogDelivery) {
      const owned = structuredClone(delivery);
      const result = await db.transaction(async (tx) => {
        await lockLogStream(tx, input);
        const row = await entryRow(tx, id);
        if (!row?.local) throw new Error("Only this device's append can be delivered");
        if (row.envelope) return { delivery: await decodeLogPayload<LogDelivery>(input, row.envelope), changed: 0 };
        await tx
          .update(entries)
          .set({ envelope: await encodeLogPayload(input, owned) })
          .where(rowWhere(id));
        return { delivery: owned, changed: 1 };
      });
      if (result.changed) statistics.record(result.changed);
      return result.delivery;
    },
    async receive(
      batches: LogReceivedBatch[],
      head: number,
      options: { from?: number; skipTo?: number; stateId?: string; through?: number } = {},
    ) {
      const owned = structuredClone({ batches, head, options });
      const result = await db.transaction(async (tx) => {
        const stream = await lockLogStream(tx, input);
        const complete = await receiveBatches(
          tx,
          owned.batches,
          (owned.options.from ?? stream.complete_through) === stream.complete_through
            ? Math.max(stream.complete_through, owned.options.skipTo ?? stream.complete_through)
            : -1,
        );
        await tx
          .update(streams)
          .set({
            head: Math.max(stream.head, owned.head),
            complete_through: Math.max(stream.complete_through, complete.complete),
            ...(owned.options.stateId === undefined
              ? {}
              : { state_id: owned.options.stateId, through: owned.options.through ?? 0 }),
          })
          .where(logWhere(streams, input));
        const removed = await pruneLogEntries(tx, input);
        return {
          changed: complete.changed + removed,
          notify:
            owned.batches.some((batch) => batch.entries.some(Boolean)) ||
            owned.head > stream.head ||
            (owned.options.stateId !== undefined && owned.options.stateId !== stream.state_id),
        };
      });
      if (result.changed) statistics.record(result.changed);
      if (result.notify) changed();
    },
    status: () => readLogStatus(db, input),
    snapshotPage: (after, limit) => orderedLogSnapshotPage(db, input, after, limit),
    watch(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies LogStreamStore;
};
