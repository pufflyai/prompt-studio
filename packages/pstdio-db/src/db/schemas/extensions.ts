import { boolean, index, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { extensionLoadStatusEnum, extensionSourceKindEnum } from "./enums";
import { projects } from "./projects";
import type { JsonObject } from "./types";

export const installed_extension_sources = pgTable(
  "extensions",
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
  (table) => [uniqueIndex("installed_ext_source_path_uq").on(table.source_path)],
);

export const project_extensions = pgTable(
  "project_extensions",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_ref: text("extension_ref")
      .notNull()
      .references(() => installed_extension_sources.id, { onDelete: "restrict" }),
    display_name: text("display_name"),
    enabled: boolean("enabled").notNull().default(true),
    config_json: jsonb("config_json").$type<JsonObject>().notNull().default({}),
    diagnostics_json: jsonb("diagnostics_json").$type<JsonObject>(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.project_id, table.extension_ref] }),
    index("project_extensions_ref_idx").on(table.extension_ref),
  ],
);
