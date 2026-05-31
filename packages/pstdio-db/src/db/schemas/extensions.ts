import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { extensionLoadStatusEnum, extensionReloadStatusEnum, extensionSourceKindEnum } from "./enums";
import { projects } from "./projects";
import type { JsonObject } from "./types";

export const installed_extension_sources = pgTable(
  "installed_extension_sources",
  {
    id: text("id").primaryKey(),
    install_name: text("install_name").notNull(),
    extension_id: text("extension_id").notNull(),
    display_name: text("display_name").notNull(),
    version: text("version"),
    source_kind: extensionSourceKindEnum("source_kind").notNull(),
    source_path: text("source_path").notNull(),
    source_ref: text("source_ref"),
    manifest_json: jsonb("manifest_json").$type<JsonObject>().notNull().default({}),
    source_hash: text("source_hash"),
    loaded_revision: text("loaded_revision"),
    status: extensionLoadStatusEnum("status").notNull().default("pending"),
    last_loaded_at: text("last_loaded_at"),
    last_error_json: jsonb("last_error_json").$type<JsonObject>(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    index("installed_ext_install_name_idx").on(table.install_name),
    uniqueIndex("installed_ext_source_path_uq").on(table.source_path),
    index("installed_ext_extension_id_idx").on(table.extension_id),
    index("installed_ext_status_idx").on(table.status),
  ],
);

export const extension_instances = pgTable(
  "extension_instances",
  {
    id: text("id").primaryKey(),
    installed_extension_id: text("installed_extension_id")
      .notNull()
      .references(() => installed_extension_sources.id, { onDelete: "restrict" }),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    display_name_override: text("display_name_override"),
    enabled: boolean("enabled").notNull().default(true),
    config_json: jsonb("config_json").$type<JsonObject>().notNull().default({}),
    diagnostics_json: jsonb("diagnostics_json").$type<JsonObject>(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_instances_scope_installed_uq").on(
      table.scope_type,
      table.scope_id,
      table.installed_extension_id,
    ),
    index("extension_instances_scope_idx").on(table.scope_type, table.scope_id),
    index("extension_instances_installed_idx").on(table.installed_extension_id),
  ],
);

export const extension_reload_events = pgTable(
  "extension_reload_events",
  {
    id: text("id").primaryKey(),
    installed_extension_id: text("installed_extension_id")
      .notNull()
      .references(() => installed_extension_sources.id, { onDelete: "cascade" }),
    previous_source_hash: text("previous_source_hash"),
    next_source_hash: text("next_source_hash"),
    previous_revision: text("previous_revision"),
    next_revision: text("next_revision"),
    status: extensionReloadStatusEnum("status").notNull(),
    error_json: jsonb("error_json").$type<JsonObject>(),
    created_at: text("created_at").notNull(),
  },
  (table) => [index("extension_reload_events_installed_idx").on(table.installed_extension_id, table.created_at)],
);

export const extension_kv = pgTable(
  "extension_kv",
  {
    project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    extension_instance_id: text("extension_instance_id")
      .notNull()
      .references(() => extension_instances.id, { onDelete: "cascade" }),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    key: text("key").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.extension_instance_id, table.scope_type, table.scope_id, table.key] }),
    index("extension_kv_instance_scope_idx").on(table.extension_instance_id, table.scope_type, table.scope_id),
    index("extension_kv_project_idx").on(table.project_id),
  ],
);

export const extension_settings = pgTable(
  "extension_settings",
  {
    owner_type: text("owner_type").notNull(),
    owner_id: text("owner_id").notNull(),
    extension_id: text("extension_id").notNull(),
    key: text("key").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.owner_type, table.owner_id, table.extension_id, table.key] }),
    index("extension_settings_owner_idx").on(table.owner_type, table.owner_id),
    index("extension_settings_extension_idx").on(table.extension_id),
  ],
);

export const extension_collection_items = pgTable(
  "extension_collection_items",
  {
    project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    extension_instance_id: text("extension_instance_id")
      .notNull()
      .references(() => extension_instances.id, { onDelete: "cascade" }),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    collection: text("collection").notNull(),
    item_id: text("item_id").notNull(),
    sort_order: integer("sort_order"),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.extension_instance_id, table.scope_type, table.scope_id, table.collection, table.item_id],
    }),
    index("extension_collection_instance_idx").on(table.extension_instance_id, table.collection),
    index("extension_collection_scope_idx").on(
      table.extension_instance_id,
      table.scope_type,
      table.scope_id,
      table.collection,
    ),
    index("extension_collection_project_idx").on(table.project_id),
  ],
);

export const extension_template_preferences = pgTable(
  "extension_template_preferences",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_instance_id: text("extension_instance_id")
      .notNull()
      .references(() => extension_instances.id, { onDelete: "cascade" }),
    template_key: text("template_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    display_name_override: text("display_name_override"),
    metadata_json: jsonb("metadata_json").$type<JsonObject>().notNull().default({}),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.extension_instance_id, table.template_key] }),
    index("extension_template_prefs_instance_idx").on(table.extension_instance_id),
  ],
);

export const extension_skill_preferences = pgTable(
  "extension_skill_preferences",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_instance_id: text("extension_instance_id")
      .notNull()
      .references(() => extension_instances.id, { onDelete: "cascade" }),
    skill_key: text("skill_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    display_name_override: text("display_name_override"),
    description_override: text("description_override"),
    metadata_json: jsonb("metadata_json").$type<JsonObject>().notNull().default({}),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.extension_instance_id, table.skill_key] }),
    index("extension_skill_prefs_instance_idx").on(table.extension_instance_id),
  ],
);
