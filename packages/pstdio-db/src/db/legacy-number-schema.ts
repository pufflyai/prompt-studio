import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
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

/** Released confirmed allocation floors. */
export const storage_ordered_resource_numbers = pgTable(
  "storage_ordered_resource_numbers",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    resource_id: text("resource_id").notNull(),
    prefix: text("prefix").notNull(),
    high_water: bigint("high_water", { mode: "number" }).notNull(),
    extension_id: text("extension_id").notNull(),
    kind: text("kind").notNull(),
    value: bigint("value", { mode: "number" }),
    current: boolean("current").notNull().default(false),
  },
  (table) => [
    primaryKey({ name: "storage_ordered_numbers_pk", columns: [table.workbench_id, table.resource_id, table.prefix] }),
    index("storage_ordered_numbers_floor").on(table.workbench_id, table.prefix, table.high_water),
    index("storage_ordered_numbers_claim")
      .on(table.workbench_id, table.extension_id, table.kind, table.prefix, table.value, table.resource_id)
      .where(sql`${table.current} = true`),
  ],
);
