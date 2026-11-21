import { boolean, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { extensionLoadStatusEnum, extensionSourceKindEnum } from "./enums";
import { files } from "./files";
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

export const extension_files = pgTable(
  "extension_files",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_instance_id: text("extension_instance_id")
      .notNull()
      .references(() => extension_instances.id, { onDelete: "restrict" }),
    file_id: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id"),
    created_at: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_files_instance_file_uq").on(table.extension_instance_id, table.file_id),
    index("extension_files_instance_scope_idx").on(table.extension_instance_id, table.scope_type, table.scope_id),
    index("extension_files_project_idx").on(table.project_id),
    index("extension_files_file_idx").on(table.file_id),
  ],
);
