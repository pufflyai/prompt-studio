import { sql } from "drizzle-orm";
import { bigserial, boolean, foreignKey, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { owners } from "./owners";
import { bytea } from "./types";

const owner = () => ({
  owner_id: integer("owner_id").notNull(),
});

/** Only ordered data lives here; public queries use the existing optimistic SQL projection. */
export const storage_ordered_records = pgTable(
  "storage_ordered_records",
  {
    ...owner(),
    record_id: text("record_id").notNull(),
    // JSON bytes preserve every public JSON key/string, including NUL and lone surrogates.
    state: bytea("state").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.owner_id, table.record_id] }),
    foreignKey({
      columns: [table.owner_id],
      foreignColumns: [owners.id],
    }).onDelete("cascade"),
  ],
);

export interface OperationReceipt {
  state: "accepted" | "refused";
  admissionFingerprint: string;
  indexed: boolean;
}
export type OperationReceipts = Record<string, OperationReceipt>;

/** Immutable authored identity, pending membership and exact per-epoch decision cache.
 * Receipt collection must preserve rooted retry facts; pending envelopes never expire. */
export const operations = pgTable(
  "operations",
  {
    ...owner(),
    operation_id: text("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    local_sequence: bigserial("local_sequence", { mode: "number" }).notNull(),
    request_fingerprint: text("request_fingerprint"),
    envelope: bytea("envelope"),
    admission_epoch: text("admission_epoch"),
    admission: bytea("admission"),
    admission_fingerprint: text("admission_fingerprint"),
    delivered: boolean("delivered").notNull().default(false),
    settled_epoch: text("settled_epoch"),
    touches: text("touches").array().notNull().default([]),
    /** Last selected foreign dependency epoch; historical receipts remain independently immutable. */
    receipt_epoch: text("receipt_epoch"),
    receipt: jsonb("receipt").$type<OperationReceipts>().notNull().default({}),
    /** All cached receipt facts are covered by the owner's encrypted receipt index. */
    receipt_indexed: boolean("receipt_indexed").notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.owner_id, table.operation_id] }),
    index("operations_pending_idx")
      .on(table.owner_id, table.local_sequence)
      .where(sql`${table.envelope} IS NOT NULL AND ${table.settled_epoch} IS NULL`),
    index("operations_touches_pending_idx")
      .using("gin", table.touches)
      .where(sql`${table.envelope} IS NOT NULL AND ${table.settled_epoch} IS NULL`),
    index("operations_unindexed_idx")
      .on(table.owner_id, table.operation_id)
      .where(sql`${table.receipt_indexed} = false`),
    foreignKey({ columns: [table.owner_id], foreignColumns: [owners.id] }).onDelete("cascade"),
  ],
);
// Keep the internal adapter name while the physical schema has one operations table.
export { operations as storage_ordered_operations };
