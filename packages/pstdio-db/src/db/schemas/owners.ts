import { bigint, boolean, integer, jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { StorageRecordIndex } from "pstdio-sync-contracts";
import { projects } from "./projects";
import { bytea } from "./types";

/** Stable local keys; project deletion owns the lifetime of every storage owner. */
export const owners = pgTable(
  "owners",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    project_id: text("project_id")
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
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    live_count: bigint("live_count", { mode: "number" }).notNull().default(0),
    record_indexes: jsonb("record_indexes")
      .$type<Record<string, { definition: StorageRecordIndex; database_name: string }>>()
      .notNull()
      .default({}),
    history_cursor: text("history_cursor"),
    history_migrated: boolean("history_migrated").notNull().default(false),
  },
  (table) => [unique("owners_project_extension_unique").on(table.project_id, table.extension_id)],
);
