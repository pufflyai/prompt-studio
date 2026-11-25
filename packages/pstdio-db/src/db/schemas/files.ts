import { sql } from "drizzle-orm";
import { bigint, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./iso-timestamp";
import { projects } from "./projects";

export const files = pgTable(
  "files",
  {
    owner: text("owner"),
    scope: text("scope"),
    path: text("path"),
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    file_name: text("file_name").notNull(),
    file_kind: text("file_kind").notNull(),
    storage_path: text("storage_path").notNull(),
    mime_type: text("mime_type"),
    size_bytes: bigint("size_bytes", { mode: "number" }).notNull(),
    hash: text("hash"),
    created_at: isoTimestamp("created_at").notNull(),
    updated_at: isoTimestamp("updated_at").notNull(),
  },
  (table) => [
    index("files_owner_scope_idx").on(table.project_id, table.owner, table.scope),
    uniqueIndex("files_owner_path_idx").on(table.owner, table.path).where(sql`${table.path} is not null`),
  ],
);
