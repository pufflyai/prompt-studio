import { boolean, index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { NativeRecordSources } from "pstdio-sync/records";
import type { StorageRecord } from "pstdio-sync-contracts";
import { owners } from "./owners";

const ownerColumns = () => ({
  owner_id: integer("owner_id")
    .notNull()
    .references(() => owners.id, { onDelete: "cascade" }),
});

export const storage_current_records = pgTable(
  "storage_current_records",
  {
    ...ownerColumns(),
    record_id: text("record_id").notNull(),
    deleted: boolean("deleted").notNull(),
    value: jsonb("value").$type<StorageRecord["value"]>(),
    query_values: jsonb("query_values")
      .$type<Record<string, Record<string, import("pstdio-sync-contracts").Json>>>()
      .notNull()
      .default({}),
    asset: jsonb("asset").$type<StorageRecord["asset"]>(),
    shared: jsonb("shared").$type<StorageRecord["shared"]>(),
    native_sources: jsonb("native_sources").$type<NativeRecordSources>().notNull().default({}),
    native_versions: jsonb("native_versions").$type<Record<string, string>>().notNull().default({}),
    record_lifetime: text("record_lifetime").notNull().default(""),
    revision: text("revision").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.owner_id, table.record_id] }),
    index("storage_current_records_native_sources_idx").using("gin", table.native_sources),
  ],
);
