import { bigint, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { Json } from "pstdio-sync-contracts";
import { owners } from "./owners";

const owner = () => ({
  owner_id: integer("owner_id")
    .notNull()
    .references(() => owners.id, { onDelete: "cascade" }),
});

/** Materialized private device-log data; these rows never become a second sync owner. */
export const storage_personal_history = pgTable(
  "history_rows",
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
      name: "history_rows_pk",
      columns: [table.owner_id, table.kind, table.device_id, table.record_id],
    }),
  ],
);

/** Canonical contributions at each device's covered log position; snapshots never include a later local overlay. */
export const storage_personal_history_sources = pgTable(
  "history_sources",
  {
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
  },
  (table) => [
    primaryKey({
      name: "history_sources_pk",
      columns: [table.owner_id, table.source_id, table.kind, table.device_id, table.record_id],
    }),
  ],
);
