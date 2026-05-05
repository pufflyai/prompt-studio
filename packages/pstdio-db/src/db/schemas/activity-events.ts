import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { activityActorTypeEnum, activitySourceEnum } from "./enums";
import { installed_extension_sources } from "./extensions";
import { projects } from "./projects";

export const activity_events = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    resource_type: text("resource_type").notNull(),
    resource_id: text("resource_id").notNull(),
    source_extension_id: text("source_extension_id").references(() => installed_extension_sources.id, {
      onDelete: "set null",
    }),
    event_type: text("event_type").notNull(),
    actor_type: activityActorTypeEnum("actor_type").notNull(),
    actor_id: text("actor_id"),
    source: activitySourceEnum("source").notNull(),
    summary: text("summary").notNull(),
    payload_json: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    created_at: text("created_at").notNull(),
  },
  (table) => [
    index("activity_events_project_created_id_idx").on(table.project_id, table.created_at, table.id),
    index("activity_events_resource_created_id_idx").on(
      table.project_id,
      table.resource_type,
      table.resource_id,
      table.created_at,
      table.id,
    ),
    index("activity_events_source_extension_idx").on(table.source_extension_id),
  ],
);
