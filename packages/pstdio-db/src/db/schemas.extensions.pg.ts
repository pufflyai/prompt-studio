import { boolean, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./schemas.pg";

type ExtensionSourceKind = "local" | "package";

export const extension_instances = pgTable(
  "extension_instances",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    display_name: text("display_name").notNull(),
    source_kind: text("source_kind").$type<ExtensionSourceKind>().notNull(),
    package_name: text("package_name"),
    package_version: text("package_version"),
    local_path: text("local_path"),
    enabled: boolean("enabled").notNull().default(true),
    config_json: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_instances_project_extension_idx").on(table.project_id, table.extension_id),
    index("extension_instances_project_idx").on(table.project_id),
  ],
);

export const extension_kv = pgTable(
  "extension_kv",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    key: text("key").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_kv_scope_key_idx").on(
      table.project_id,
      table.extension_id,
      table.scope_type,
      table.scope_id,
      table.key,
    ),
    index("extension_kv_project_idx").on(table.project_id),
  ],
);

export const extension_collection_items = pgTable(
  "extension_collection_items",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    collection: text("collection").notNull(),
    item_id: text("item_id").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_collection_items_scope_item_idx").on(
      table.project_id,
      table.extension_id,
      table.scope_type,
      table.scope_id,
      table.collection,
      table.item_id,
    ),
    index("extension_collection_items_project_idx").on(table.project_id),
  ],
);

export const extension_template_preferences = pgTable(
  "extension_template_preferences",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    template_key: text("template_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_template_preferences_key_idx").on(table.project_id, table.extension_id, table.template_key),
    index("extension_template_preferences_project_idx").on(table.project_id),
  ],
);
