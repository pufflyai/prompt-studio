import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, foreignKey, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

const owner = () => ({
  workbench_id: text("workbench_id").notNull(),
  extension_id: text("extension_id").notNull(),
});

/** New-format owner state. Its existence does not mean transport has opened. */
export const storage_ordered_owners = pgTable(
  "storage_ordered_owners",
  {
    ...owner(),
    epoch: text("epoch"),
    joined: boolean("joined").notNull().default(false),
    after: bigint("after", { mode: "number" }).notNull().default(0),
    state_id: text("state_id"),
    through: bigint("through", { mode: "number" }).notNull().default(0),
    pending_bytes: bigint("pending_bytes", { mode: "number" }).notNull().default(0),
    state_bytes: bigint("state_bytes", { mode: "number" }).notNull().default(0),
    skipped: boolean("skipped").notNull().default(false),
    receipt_root: bytea("receipt_root"),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id] }),
    foreignKey({ columns: [table.workbench_id], foreignColumns: [projects.id] }).onDelete("cascade"),
  ],
);

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
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.record_id] }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_ordered_owners.workbench_id, storage_ordered_owners.extension_id],
    }).onDelete("cascade"),
  ],
);

/** Global identity binding and this device's immutable local envelope, when it authored one. */
export const storage_ordered_operations = pgTable(
  "storage_ordered_operations",
  {
    ...owner(),
    operation_id: text("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    local_sequence: bigserial("local_sequence", { mode: "number" }).notNull(),
    request_fingerprint: text("request_fingerprint"),
    envelope: bytea("envelope"),
    // A new epoch changes delivery coordinates, never the authored envelope or its conditions.
    admission_epoch: text("admission_epoch"),
    admission: bytea("admission"),
    admission_fingerprint: text("admission_fingerprint"),
    delivered: boolean("delivered").notNull().default(false),
    settled_epoch: text("settled_epoch"),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.operation_id] }),
    index("storage_ordered_operations_pending_idx")
      .on(table.workbench_id, table.extension_id, table.local_sequence)
      .where(sql`${table.envelope} IS NOT NULL AND ${table.settled_epoch} IS NULL`),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_ordered_owners.workbench_id, storage_ordered_owners.extension_id],
    }).onDelete("cascade"),
  ],
);

/** Indexed membership of unresolved local groups; rebasing one record never scans every pending save. */
export const storage_ordered_touches = pgTable(
  "storage_ordered_touches",
  {
    ...owner(),
    record_id: text("record_id").notNull(),
    operation_id: text("operation_id").notNull(),
    local_sequence: bigint("local_sequence", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.record_id, table.operation_id] }),
    index("storage_ordered_touches_operation_idx").on(table.workbench_id, table.extension_id, table.operation_id),
    index("storage_ordered_touches_record_sequence_idx").on(
      table.workbench_id,
      table.extension_id,
      table.record_id,
      table.local_sequence,
    ),
    foreignKey({
      columns: [table.workbench_id, table.extension_id, table.operation_id],
      foreignColumns: [
        storage_ordered_operations.workbench_id,
        storage_ordered_operations.extension_id,
        storage_ordered_operations.operation_id,
      ],
    }).onDelete("cascade"),
  ],
);

/** Exact cached decisions; a cache miss still needs the rooted encrypted receipt index. */
export const storage_ordered_receipts = pgTable(
  "storage_ordered_receipts",
  {
    ...owner(),
    epoch: text("epoch").notNull(),
    operation_id: text("operation_id").notNull(),
    admission_fingerprint: text("admission_fingerprint").notNull(),
    state: text("state").$type<"accepted" | "refused">().notNull(),
    /** This exact receipt is included in the owner's retained encrypted root. */
    indexed: boolean("indexed").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.epoch, table.operation_id] }),
    index("storage_ordered_receipts_unindexed_idx")
      .on(table.workbench_id, table.extension_id, table.epoch, table.operation_id)
      .where(sql`${table.indexed} = false`),
    foreignKey({
      columns: [table.workbench_id, table.extension_id, table.operation_id],
      foreignColumns: [
        storage_ordered_operations.workbench_id,
        storage_ordered_operations.extension_id,
        storage_ordered_operations.operation_id,
      ],
    }).onDelete("cascade"),
  ],
);
