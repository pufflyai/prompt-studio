import { bigint, foreignKey, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { storage_record_projections } from "./storage-records";
import { bytea } from "./types";

const ownerColumns = () => ({
  workbench_id: text("workbench_id").notNull(),
  extension_id: text("extension_id").notNull(),
});

// These derived rows share the projection's source revision and atomic publication boundary.
export const storage_record_fragments = pgTable(
  "storage_record_fragments",
  {
    ...ownerColumns(),
    record_id: text("record_id").notNull(),
    state: bytea("state").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.record_id] }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_record_projections.workbench_id, storage_record_projections.extension_id],
    }).onDelete("cascade"),
  ],
);

export const storage_record_actor_clocks = pgTable(
  "storage_record_actor_clocks",
  {
    ...ownerColumns(),
    client: bigint("client", { mode: "number" }).notNull(),
    clock: bigint("clock", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.client] }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_record_projections.workbench_id, storage_record_projections.extension_id],
    }).onDelete("cascade"),
  ],
);

export const storage_record_ownership = pgTable(
  "storage_record_ownership",
  {
    ...ownerColumns(),
    client: bigint("client", { mode: "number" }).notNull(),
    start_clock: bigint("start_clock", { mode: "number" }).notNull(),
    end_clock: bigint("end_clock", { mode: "number" }).notNull(),
    record_id: text("record_id").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_record_ownership_pk",
      columns: [table.workbench_id, table.extension_id, table.client, table.start_clock],
    }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_record_projections.workbench_id, storage_record_projections.extension_id],
    }).onDelete("cascade"),
  ],
);
