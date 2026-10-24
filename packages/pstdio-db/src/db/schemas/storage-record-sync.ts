import { bigint, bigserial, boolean, foreignKey, index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

// How far this device has read an owner's encrypted record stream. Exists only while the owner syncs.
export const storage_record_sync = pgTable(
  "storage_record_sync",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    generation: integer("generation").notNull(),
    joined: boolean("joined").notNull().default(false),
    after: bigint("after", { mode: "number" }).notNull().default(0),
    state_id: text("state_id"),
    through: bigint("through", { mode: "number" }).notNull().default(0),
    pending_bytes: bigint("pending_bytes", { mode: "number" }).notNull().default(0),
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
