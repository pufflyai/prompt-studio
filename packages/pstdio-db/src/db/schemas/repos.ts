import { pgTable, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const repos = pgTable("repos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  display_name: text("display_name"),
  path: text("path").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const project_repos = pgTable("project_repos", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  repo_id: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  created_at: text("created_at").notNull(),
});
