import { bigint, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { extension_instances } from "./extensions";

/** Host-owned progress follows an instance without occupying its public storage namespace. */
export const extension_data_versions = pgTable(
  "extension_data_versions",
  {
    extension_instance_id: text("extension_instance_id")
      .notNull()
      .references(() => extension_instances.id, { onDelete: "cascade" }),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    version: bigint("version", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.extension_instance_id, table.scope_type, table.scope_id] })],
);
