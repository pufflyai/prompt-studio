import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, foreignKey, index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

const address = () => ({
  workbench_id: text("workbench_id").notNull(),
  extension_id: text("extension_id").notNull(),
  log_name: text("log_name").notNull(),
  scope: text("scope").notNull(),
  stream: text("stream").notNull(),
});

/** One relay document; a device-writer declaration has one row per independent writer. */
export const storage_log_streams = pgTable(
  "storage_log_streams",
  {
    ...address(),
    head: bigint("head", { mode: "number" }).notNull().default(0),
    complete_through: bigint("complete_through", { mode: "number" }).notNull().default(0),
    state_id: text("state_id"),
    through: bigint("through", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "storage_log_streams_pk",
      columns: [table.workbench_id, table.extension_id, table.log_name, table.scope, table.stream],
    }),
    foreignKey({
      name: "storage_log_streams_project_fk",
      columns: [table.workbench_id],
      foreignColumns: [projects.id],
    }).onDelete("cascade"),
  ],
);

/** Immutable append payloads. Delivery coordinates may settle; entry content never changes. */
export const storage_log_entries = pgTable(
  "storage_log_entries",
  {
    ...address(),
    entry_id: text("entry_id").notNull(),
    writer_id: text("writer_id").notNull(),
    created_at: bigint("created_at", { mode: "number" }).notNull(),
    fingerprint: text("fingerprint").notNull(),
    entry: bytea("entry").notNull(),
    local_sequence: bigserial("local_sequence", { mode: "number" }).notNull(),
    local: boolean("local").notNull().default(false),
    relay_sequence: bigint("relay_sequence", { mode: "number" }),
    relay_index: integer("relay_index"),
    envelope: bytea("envelope"),
  },
  (table) => [
    primaryKey({
      name: "storage_log_entries_pk",
      columns: [table.workbench_id, table.extension_id, table.log_name, table.scope, table.stream, table.entry_id],
    }),
    index("storage_log_entries_relay_idx").on(
      table.workbench_id,
      table.extension_id,
      table.log_name,
      table.scope,
      table.stream,
      table.relay_sequence,
      table.relay_index,
    ),
    index("storage_log_entries_pending_idx")
      .on(table.workbench_id, table.extension_id, table.log_name, table.scope, table.stream, table.local_sequence)
      .where(sql`${table.local} = true AND ${table.relay_sequence} IS NULL`),
    index("storage_log_entries_retention_idx").on(
      table.workbench_id,
      table.extension_id,
      table.log_name,
      table.scope,
      table.stream,
      table.created_at,
    ),
    foreignKey({
      name: "storage_log_entries_stream_fk",
      columns: [table.workbench_id, table.extension_id, table.log_name, table.scope, table.stream],
      foreignColumns: [
        storage_log_streams.workbench_id,
        storage_log_streams.extension_id,
        storage_log_streams.log_name,
        storage_log_streams.scope,
        storage_log_streams.stream,
      ],
    }).onDelete("cascade"),
  ],
);
