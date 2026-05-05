import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { templateDefaultSourceEnum } from "./enums";
import { extension_instances } from "./extensions";
import { files } from "./files";
import { projects } from "./projects";

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  template_type: text("template_type").notNull(),
  file_id: text("file_id")
    .notNull()
    .references(() => files.id),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const project_template_defaults = pgTable(
  "project_template_defaults",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    template_type: text("template_type").notNull(),
    source: templateDefaultSourceEnum("source").notNull(),
    template_id: text("template_id").references(() => templates.id, { onDelete: "cascade" }),
    extension_instance_id: text("extension_instance_id").references(() => extension_instances.id, {
      onDelete: "cascade",
    }),
    template_key: text("template_key"),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.project_id, table.template_type] })],
);
