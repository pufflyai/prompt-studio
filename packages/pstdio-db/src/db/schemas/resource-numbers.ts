import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/** Shown aliases and confirmed claims share one indexed allocation history.
 * Each projection replaces its own flags; tuples leave when neither projection references them.
 * Project deletion cascades through every retained claim and allocation floor. */
export const resource_numbers = pgTable(
  "resource_numbers",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shorthand: text("shorthand").notNull(),
    resource_id: text("resource_id").notNull(),
    extension_id: text("extension_id").notNull(),
    kind: text("kind").notNull(),
    prefix: text("prefix").notNull(),
    value: bigint("value", { mode: "number" }).notNull(),
    current: boolean("current").notNull().default(false),
    alias: boolean("alias").notNull().default(false),
    canonical: boolean("canonical").notNull().default(false),
    canonical_current: boolean("canonical_current").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.shorthand, table.resource_id] }),
    index("resource_numbers_resource").on(table.project_id, table.resource_id),
    index("resource_numbers_floor").on(table.project_id, table.prefix, table.value),
    index("resource_numbers_canonical_claim")
      .on(table.project_id, table.extension_id, table.kind, table.prefix, table.value)
      .where(sql`${table.canonical_current}=true`),
  ],
);
