import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    origin: text("origin").notNull(),
    source_extension_id: text("source_extension_id"),
    actor_type: text("actor_type"),
    actor_id: text("actor_id"),
    title: text("title").notNull(),
    body: text("body"),
    kind: text("kind").notNull(),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("open"),
    target_json: jsonb("target_json").$type<Record<string, unknown> | null>(),
    related_json: jsonb("related_json").$type<unknown[]>().notNull().default([]),
    actions_json: jsonb("actions_json").$type<unknown[]>().notNull().default([]),
    metadata_json: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    dedupe_key: text("dedupe_key"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    read_at: text("read_at"),
    resolved_at: text("resolved_at"),
    snoozed_until: text("snoozed_until"),
    expires_at: text("expires_at"),
  },
  (table) => [
    index("notifications_project_status_updated_idx").on(table.project_id, table.status, table.updated_at, table.id),
    index("notifications_project_priority_status_idx").on(
      table.project_id,
      table.priority,
      table.status,
      table.updated_at,
    ),
    uniqueIndex("notifications_project_live_dedupe_unique")
      .on(table.project_id, table.dedupe_key)
      .where(sql`${table.dedupe_key} IS NOT NULL AND ${table.status} IN ('open', 'read', 'snoozed')`),
    index("notifications_project_source_status_idx").on(table.project_id, table.source_extension_id, table.status),
  ],
);
