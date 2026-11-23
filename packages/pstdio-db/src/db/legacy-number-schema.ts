import { bigint, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./schemas/projects";

const project = () =>
  text("workbench_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" });

export const storage_resource_identities = pgTable(
  "storage_resource_identities",
  {
    workbench_id: project(),
    resource_id: text("resource_id").notNull(),
    extension_id: text("extension_id").notNull(),
    kind: text("kind").notNull(),
    shorthand: text("shorthand").notNull(),
    prefix: text("prefix").notNull().default(""),
    value: bigint("value", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.resource_id] }),
    index("storage_resource_identity_number").on(
      table.workbench_id,
      table.extension_id,
      table.kind,
      table.shorthand,
      table.resource_id,
    ),
    index("storage_resource_identity_high_water").on(table.workbench_id, table.prefix, table.value),
  ],
);

export const storage_resource_aliases = pgTable(
  "storage_resource_aliases",
  {
    workbench_id: project(),
    resource_id: text("resource_id").notNull(),
    shorthand: text("shorthand").notNull(),
    prefix: text("prefix").notNull().default(""),
    value: bigint("value", { mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.resource_id, table.shorthand] }),
    index("storage_resource_identity_alias").on(table.workbench_id, table.shorthand, table.resource_id),
    index("storage_resource_alias_high_water").on(table.workbench_id, table.prefix, table.value),
  ],
);
