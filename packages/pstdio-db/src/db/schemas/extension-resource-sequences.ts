import { integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const extension_resource_sequences = pgTable(
  "extension_resource_sequences",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    kind: text("kind").notNull(),
    prefix: text("prefix").notNull(),
    next_value: integer("next_value").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.extension_id, table.kind] }),
    uniqueIndex("extension_resource_sequences_project_prefix_uq").on(table.project_id, table.prefix),
  ],
);
