import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import type { JsonObject } from "./types";
export type ExtensionConnectionCheck = {
  ok: boolean;
  status: number | null;
  error: string | null;
  checkedAt: string;
};

export const extension_connections = pgTable(
  "extension_connections",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    contribution_id: text("contribution_id").notNull(),
    base_url: text("base_url").notNull(),
    auth_type: text("auth_type").$type<"bearer" | "header">().notNull(),
    auth_header_name: text("auth_header_name"),
    secret_ref: text("secret_ref"),
    config_json: jsonb("config_json").$type<JsonObject>().notNull().default({}),
    last_check_json: jsonb("last_check_json").$type<ExtensionConnectionCheck>(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("extension_connections_project_contribution_idx").on(
      table.project_id,
      table.extension_id,
      table.contribution_id,
    ),
  ],
);
