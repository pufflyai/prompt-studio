import { bigint, boolean, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { Json } from "pstdio-sync-contracts";
import { projects } from "./projects";

const owner = () => ({
  workbench_id: text("workbench_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  extension_id: text("extension_id").notNull(),
});

/** Materialized private device-log data; these rows never become a second sync owner. */
export const storage_personal_history = pgTable(
  "storage_personal_history",
  {
    ...owner(),
    device_id: text("device_id").notNull(),
    kind: text("kind").notNull(),
    record_id: text("record_id").notNull(),
    value: jsonb("value").$type<Json>(),
    seed_id: text("seed_id"),
    pending_id: text("pending_id"),
  },
  (table) => [
    primaryKey({
      name: "storage_personal_history_pk",
      columns: [table.workbench_id, table.extension_id, table.kind, table.device_id, table.record_id],
    }),
  ],
);

/** Canonical contributions at each device's covered log position; snapshots never include a later local overlay. */
export const storage_personal_history_sources = pgTable("storage_personal_history_sources", {
  ...owner(),
  source_id: text("source_id").notNull(),
  kind: text("kind").notNull(),
  device_id: text("device_id").notNull(),
  record_id: text("record_id").notNull(),
  value: jsonb("value").$type<Json>(),
  seed_id: text("seed_id"),
  entry_id: text("entry_id").notNull(),
  sequence: bigint("sequence", { mode: "number" }).notNull(),
  entry_index: integer("entry_index").notNull(),
}, (table) => [primaryKey({ name: "storage_personal_history_sources_pk", columns: [table.workbench_id, table.extension_id, table.source_id, table.kind, table.device_id, table.record_id] })]);

/** The cursor advances atomically with the rows obtained from that page. */
export const storage_personal_history_positions = pgTable(
  "storage_personal_history_positions",
  {
    ...owner(),
    cursor: text("cursor"),
    migrated: boolean("migrated").notNull().default(false),
  },
  (table) => [
    primaryKey({ name: "storage_personal_history_positions_pk", columns: [table.workbench_id, table.extension_id] }),
  ],
);
