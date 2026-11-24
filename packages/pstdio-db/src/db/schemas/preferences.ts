import { index, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./iso-timestamp";
import { projects } from "./projects";

export const preferences = pgTable(
  "preferences",
  {
    scope: text("scope").$type<"global" | "user" | "project" | "workspace" | "session" | "resource">().notNull(),
    scope_id: text("scope_id").notNull(),
    extension_id: text("extension_id").notNull().default(""),
    key: text("key").notNull(),
    sync: text("sync").$type<"team" | "personal" | "device">().notNull(),
    value: jsonb("value").$type<unknown>(),
    project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    updated_at: isoTimestamp("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.scope_id, table.extension_id, table.key] }),
    index("preferences_extension_idx").on(table.extension_id),
    index("preferences_project_idx").on(table.project_id),
  ],
);
