import { sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/** Derived only from ordered canonical records, never from this device's pending number projection. */
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
