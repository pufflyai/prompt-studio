import { and, asc, count, gt } from "drizzle-orm";
import type { ReadResult, StateInfo } from "pstdio-sync-contracts/protocol";
import type { RelayLimits } from "../limits";
import { checkProject, rejection, type SyncCaller } from "./accounts";
import type { connectRelay } from "./database";
import { type DocumentAddress, documentWhere, stateWhere, updateWhere } from "./document-address";
import { syncDocuments, syncStates, syncUpdates } from "./document-schema";
import type { PayloadObjects } from "./payloads";

// Bounds one read, so a far-behind device pages through updates instead of loading them all.
const pageSize = 1000;
const fetchConcurrency = 8;

export const stateInfo = (row: typeof syncStates.$inferSelect): StateInfo => ({
  stateId: row.stateId,
  baseStateId: row.baseStateId,
  through: row.through,
  byteLength: row.byteLength,
  summary: row.summary,
  deviceId: row.deviceId,
  createdAt: row.createdAt.toISOString(),
});

const mapLimited = async <T, R>(items: T[], limit: number, action: (item: T) => Promise<R>) => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await action(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

export const createDocumentReads = (
  connection: ReturnType<typeof connectRelay>,
  payloads: PayloadObjects,
  limits: RelayLimits,
) => {
  const snapshot = (address: DocumentAddress, caller: SyncCaller, after: number, signal?: AbortSignal) =>
    connection.run(
      (db) =>
        db.transaction(
          async (transaction) => {
            await checkProject(transaction, address.projectId, caller.accountId);
            const [document] = await transaction.select().from(syncDocuments).where(documentWhere(address));
            if (document && document.spaceOwner !== address.spaceOwner) throw rejection(404, "not-found");
            const lastSequence = document?.lastSequence ?? 0;
            const [state] = document?.stateId
              ? await transaction.select().from(syncStates).where(stateWhere(address, document.stateId))
              : [];
            const base = { state: state ? stateInfo(state) : null, lastSequence };
            const newer = and(updateWhere(address), gt(syncUpdates.sequence, after));
            const [{ stored }] = (await transaction.select({ stored: count() }).from(syncUpdates).where(newer)) as [
              { stored: number },
            ];
            // Sequences have no gaps, so a smaller count means cleanup removed updates the client still needs.
            if (after > lastSequence || stored !== lastSequence - after) return { ...base, rows: null };
            const rows = await transaction
              .select()
              .from(syncUpdates)
              .where(newer)
              .orderBy(asc(syncUpdates.sequence))
              .limit(pageSize);
            return { ...base, rows };
          },
          { isolationLevel: "repeatable read", accessMode: "read only" },
        ),
      signal,
    );

  return {
    /** Returns the latest state's metadata and the updates after `after`, or asks for the latest state. */
    async read(address: DocumentAddress, caller: SyncCaller, after: number, signal?: AbortSignal) {
      const { state, lastSequence, rows } = await snapshot(address, caller, after, signal);
      const required: ReadResult = { status: "state-required", state, lastSequence };
      if (!rows) return required;
      let bytes = 0;
      const page = rows.filter((row, index) => {
        bytes += row.byteLength;
        return index === 0 || bytes <= limits.maxReadBytes;
      });
      const updates = await mapLimited(page, fetchConcurrency, async (row) => {
        const body = await payloads.open(row.objectKey, signal);
        if (!body) return null;
        return {
          sequence: row.sequence,
          updateId: row.updateId,
          deviceId: row.deviceId,
          payload: Buffer.from(await body.transformToByteArray()).toString("base64"),
          createdAt: row.createdAt.toISOString(),
        };
      });
      // Cleanup removed bytes after this read's snapshot. The latest state already includes them.
      if (updates.some((update) => update === null)) return required;
      const last = page.at(-1)?.sequence ?? after;
      return {
        status: "updates",
        state,
        lastSequence,
        updates: updates as NonNullable<(typeof updates)[number]>[],
        more: last < lastSequence,
      } satisfies ReadResult;
    },

    /** Streams one latest state's encrypted bytes. Replaced states stay readable for the grace period. */
    async readState(address: DocumentAddress, caller: SyncCaller, stateId: string, signal?: AbortSignal) {
      const row = await connection.run(async (db) => {
        await checkProject(db, address.projectId, caller.accountId);
        const [document] = await db
          .select({ spaceOwner: syncDocuments.spaceOwner })
          .from(syncDocuments)
          .where(documentWhere(address));
        if (!document || document.spaceOwner !== address.spaceOwner) return null;
        const [state] = await db.select().from(syncStates).where(stateWhere(address, stateId));
        return state ?? null;
      }, signal);
      if (!row) return null;
      const body = await payloads.open(row.objectKey, signal);
      return body && { state: stateInfo(row), body: body.transformToWebStream() };
    },
  };
};
