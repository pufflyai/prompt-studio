import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  file_name: text("file_name").notNull(),
  file_kind: text("file_kind").notNull(),
  storage_path: text("storage_path").notNull(),
  mime_type: text("mime_type"),
  size_bytes: integer("size_bytes").notNull(),
  hash: text("hash"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
