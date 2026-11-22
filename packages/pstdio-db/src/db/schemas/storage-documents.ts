import { bigint, foreignKey, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { owners } from "./owners";
import { bytea } from "./types";

export const storage_documents = pgTable(
  "storage_documents",
  {
    owner_id: integer("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    document_id: text("document_id").notNull(),
    state: bytea("state").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull().default(0),
    folded_revision: bigint("folded_revision", { mode: "number" }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.owner_id, table.document_id] })],
);

export const storage_document_updates = pgTable(
  "storage_document_updates",
  {
    owner_id: integer("owner_id").notNull(),
    document_id: text("document_id").notNull(),
    revision: bigint("revision", { mode: "number" }).notNull(),
    update: bytea("update").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_document_updates_pk",
      columns: [table.owner_id, table.document_id, table.revision],
    }),
    foreignKey({
      name: "storage_document_updates_document_fk",
      columns: [table.owner_id, table.document_id],
      foreignColumns: [storage_documents.owner_id, storage_documents.document_id],
    }).onDelete("cascade"),
  ],
);

// Retry identities stay local and indexed. They are not document content or replay history.
export const storage_document_operations = pgTable(
  "storage_document_operations",
  {
    owner_id: integer("owner_id").notNull(),
    document_id: text("document_id").notNull(),
    operation_id: text("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
  },
  (table) => [
    primaryKey({
      name: "storage_document_operations_pk",
      columns: [table.owner_id, table.document_id, table.operation_id],
    }),
    foreignKey({
      name: "storage_document_operations_document_fk",
      columns: [table.owner_id, table.document_id],
      foreignColumns: [storage_documents.owner_id, storage_documents.document_id],
    }).onDelete("cascade"),
  ],
);
