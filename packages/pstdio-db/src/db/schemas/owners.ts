import { boolean, integer, pgTable, text, unique } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/** Stable local keys; project deletion owns the lifetime of every storage owner. */
export const owners = pgTable(
  "owners",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    history_cursor: text("history_cursor"),
    history_migrated: boolean("history_migrated").notNull().default(false),
  },
  (table) => [unique("owners_project_extension_unique").on(table.project_id, table.extension_id)],
);
