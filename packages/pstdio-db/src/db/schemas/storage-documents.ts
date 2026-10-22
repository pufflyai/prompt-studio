import { bigint, foreignKey, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

export const storage_documents = pgTable(
  "storage_documents",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    document_id: text("document_id").notNull(),
    state: bytea("state").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    folded_revision: bigint("folded_revision", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.workbench_id, table.extension_id, table.document_id] })],
);

export const storage_document_updates = pgTable(
  "storage_document_updates",
  {
    workbench_id: text("workbench_id").notNull(),
    extension_id: text("extension_id").notNull(),
    document_id: text("document_id").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull(),
    update: bytea("update").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_document_updates_pk",
      columns: [table.workbench_id, table.extension_id, table.document_id, table.revision],
    }),
    foreignKey({
      name: "storage_document_updates_document_fk",
      columns: [table.workbench_id, table.extension_id, table.document_id],
      foreignColumns: [storage_documents.workbench_id, storage_documents.extension_id, storage_documents.document_id],
    }).onDelete("cascade"),
  ],
);

// Retry identities stay local and indexed. They are not document content or replay history.
export const storage_document_operations = pgTable(
  "storage_document_operations",
  {
    workbench_id: text("workbench_id").notNull(),
    extension_id: text("extension_id").notNull(),
    document_id: text("document_id").notNull(),
    operation_id: text("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_document_operations_pk",
      columns: [table.workbench_id, table.extension_id, table.document_id, table.operation_id],
    }),
    foreignKey({
      name: "storage_document_operations_document_fk",
      columns: [table.workbench_id, table.extension_id, table.document_id],
      foreignColumns: [storage_documents.workbench_id, storage_documents.extension_id, storage_documents.document_id],
    }).onDelete("cascade"),
  ],
);
