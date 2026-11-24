import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
} from "drizzle-orm/pg-core";
import { owners } from "./owners";
import { bytea } from "./types";

const address = () => ({
  owner_id: integer("owner_id").notNull(),
  log_name: text("log_name").notNull(),
  scope: text("scope").notNull(),
  stream: text("stream").notNull(),
});

/** One relay document; a device-writer declaration has one row per independent writer. */
export const storage_log_streams = pgTable(
  "log_streams",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    ...address(),
    head: bigint("head", { mode: "number" }).notNull().default(0),
    complete_through: bigint("complete_through", { mode: "number" }).notNull().default(0),
    state_id: text("state_id"),
    through: bigint("through", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    unique("log_streams_owner_address_unique").on(table.owner_id, table.log_name, table.scope, table.stream),
    foreignKey({
      name: "log_streams_owner_fk",
      columns: [table.owner_id],
      foreignColumns: [owners.id],
    }).onDelete("cascade"),
  ],
);

/** Immutable append payloads. Delivery coordinates may settle; entry content never changes. */
export const storage_log_entries = pgTable(
  "log_entries",
  {
    stream_id: bigint("stream_id", { mode: "bigint" }).notNull(),
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
      name: "log_entries_pk",
      columns: [table.stream_id, table.entry_id],
    }),
    index("log_entries_relay_idx").on(table.stream_id, table.relay_sequence, table.relay_index),
    index("log_entries_pending_idx")
      .on(table.stream_id, table.local_sequence)
      .where(sql`${table.local} = true AND ${table.relay_sequence} IS NULL`),
    index("log_entries_retention_idx").on(table.stream_id, table.created_at),
    foreignKey({
      name: "log_entries_stream_fk",
      columns: [table.stream_id],
      foreignColumns: [storage_log_streams.id],
    }).onDelete("cascade"),
  ],
);
