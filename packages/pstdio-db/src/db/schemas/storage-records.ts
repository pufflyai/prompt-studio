import { sql } from "drizzle-orm";
import { bigint, boolean, foreignKey, index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { StorageRecord, StorageRecordIndex } from "pstdio-sync-contracts";
import { projects } from "./projects";
import { storage_documents } from "./storage-documents";

const ownerColumns = () => ({
  workbench_id: text("workbench_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  extension_id: text("extension_id").notNull(),
});

export const storage_record_projections = pgTable(
  "storage_record_projections",
  {
    ...ownerColumns(),
    document_id: text("document_id").notNull().default("records"),
    revision: bigint("revision", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id] }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id, table.document_id],
      foreignColumns: [storage_documents.workbench_id, storage_documents.extension_id, storage_documents.document_id],
    }).onDelete("cascade"),
  ],
);

export const storage_current_records = pgTable(
  "storage_current_records",
  {
    ...ownerColumns(),
    record_id: text("record_id").notNull(),
    deleted: boolean("deleted").notNull(),
    value: jsonb("value").$type<StorageRecord["value"]>(),
    asset: jsonb("asset").$type<StorageRecord["asset"]>(),
    shared: jsonb("shared").$type<StorageRecord["shared"]>(),
    revision: text("revision").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.extension_id, table.record_id] }),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_record_projections.workbench_id, storage_record_projections.extension_id],
    }).onDelete("cascade"),
  ],
);

export const storage_record_types = pgTable(
  "storage_record_types",
  {
    ...ownerColumns(),
    type_name: text("type_name").notNull(),
    type_kind: text("type_kind").$type<"map" | "list" | "text">().notNull(),
    record_id: text("record_id").notNull(),
  },
  (table) => [
    index("storage_record_types_lookup").on(table.workbench_id, table.extension_id, sql`md5(${table.type_name})`),
    foreignKey({
      columns: [table.workbench_id, table.extension_id],
      foreignColumns: [storage_record_projections.workbench_id, storage_record_projections.extension_id],
    }).onDelete("cascade"),
  ],
);

export const storage_record_indexes = pgTable(
  "storage_record_indexes",
  {
    ...ownerColumns(),
    name: text("name").notNull(),
    definition: jsonb("definition").$type<StorageRecordIndex>().notNull(),
    database_name: text("database_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.workbench_id, table.extension_id, table.name] })],
);
