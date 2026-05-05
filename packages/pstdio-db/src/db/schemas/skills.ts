import { pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { files } from "./files";
import { projects } from "./projects";

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const skill_files = pgTable(
  "skill_files",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skill_id: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    file_id: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "restrict" }),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.skill_id, table.path] }),
    uniqueIndex("skill_files_skill_file_idx").on(table.skill_id, table.file_id),
  ],
);
