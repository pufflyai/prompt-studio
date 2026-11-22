import { and, inArray, sql } from "drizzle-orm";
import type { PgInsertValue } from "drizzle-orm/pg-core";
import type { StorageOwner } from "pstdio-sync";
import type { OrderedRecord } from "pstdio-sync/records";
import { storage_ordered_records as canonical } from "../../db/schemas.pg";
import {
  decodeOrderedJson as decode,
  encodeOrderedJson as encode,
  type OrderedTransaction,
  orderedAddress,
  orderedOwnerWhere as ownerWhere,
} from "./ordered-sql";

export const createOrderedCanonical = (tx: OrderedTransaction, owner: StorageOwner) => {
  const address = orderedAddress(owner);
  return {
    async canonical(ids: string[]) {
      const found = new Map<string, OrderedRecord>();
      for (let offset = 0; offset < ids.length; offset += 1_000) {
        const rows = await tx
          .select()
          .from(canonical)
          .where(and(ownerWhere(canonical, owner), inArray(canonical.record_id, ids.slice(offset, offset + 1_000))));
        for (const row of rows) found.set(row.record_id, decode<OrderedRecord>(row.state));
      }
      return found;
    },
    async saveCanonical(records: OrderedRecord[]) {
      let batch: PgInsertValue<typeof canonical>[] = [];
      let bytes = 0;
      const flush = async () => {
        if (!batch.length) return;
        await tx
          .insert(canonical)
          .values(batch)
          .onConflictDoUpdate({
            target: [canonical.owner_id, canonical.record_id],
            set: { state: sql`excluded.state` },
          });
        batch = [];
        bytes = 0;
      };
      for (const record of records) {
        const state = encode(record);
        if (bytes + state.length > 4 * 1024 * 1024 || batch.length >= 1_000) await flush();
        batch.push({ ...address, record_id: record.recordId, state });
        bytes += state.length;
      }
      await flush();
    },
  };
};
