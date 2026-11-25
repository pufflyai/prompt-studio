import { bigint, pgTable, primaryKey, text, unique } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const resource_prefixes = pgTable(
  "resource_prefixes",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prefix: text("prefix").notNull(),
    extension_id: text("extension_id").notNull(),
    kind: text("kind").notNull(),
    next_value: bigint("next_value", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.prefix] }),
    unique("resource_prefixes_project_extension_kind_unique").on(table.project_id, table.extension_id, table.kind),
  ],
);
