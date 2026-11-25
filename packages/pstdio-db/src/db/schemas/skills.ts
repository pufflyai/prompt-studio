import { pgTable, text } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./iso-timestamp";
import { projects } from "./projects";

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  created_at: isoTimestamp("created_at").notNull(),
  updated_at: isoTimestamp("updated_at").notNull(),
  deleted_at: isoTimestamp("deleted_at"),
});
