import { bigint, bigserial, boolean, foreignKey, index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { Asset } from "pstdio-sync-contracts";
import { projects } from "./schemas/projects";
import { bytea } from "./schemas/types";

/** Released input definitions, deliberately outside the generated target schema. */
export const storage_ordered_owners = pgTable(
  "storage_ordered_owners",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
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
  (table) => [primaryKey({ columns: [table.workbench_id, table.extension_id] })],
);

// How far this device has read an owner's encrypted record stream. Exists only while the owner syncs.
export const storage_record_sync = pgTable(
  "storage_record_sync",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    joined: boolean("joined").notNull().default(false),
    after: bigint("after", { mode: "number" }).notNull().default(0),
    state_id: text("state_id"),
    through: bigint("through", { mode: "number" }).notNull().default(0),
    pending_bytes: bigint("pending_bytes", { mode: "number" }).notNull().default(0),
    // Encrypted size of that latest state, which sets when the update tail is large enough to replace.
    state_bytes: bigint("state_bytes", { mode: "number" }).notNull().default(0),
    // Set while this device lacks a frame or record the stream holds, so it builds no latest state.
    skipped: boolean("skipped").notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.workbench_id, table.extension_id] })],
);

// Local record saves the relay does not hold yet. A row is one save, so it uploads as one unit (R4).
export const storage_record_outbox = pgTable(
  "storage_record_outbox",
  {
    sequence: bigserial("sequence", { mode: "number" }).primaryKey(),
    workbench_id: text("workbench_id").notNull(),
    extension_id: text("extension_id").notNull(),
    frame: bytea("frame").notNull(),
    // The files this save's records point to, uploaded before the save (R21).
    assets: jsonb("assets").$type<Asset[]>().notNull().default([]),
  },
  (table) => [
    index("storage_record_outbox_owner_idx").on(table.workbench_id, table.extension_id, table.sequence),
    foreignKey({
      name: "storage_record_outbox_sync_fk",
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_record_sync.workbench_id, storage_record_sync.extension_id],
    }).onDelete("cascade"),
  ],
);
