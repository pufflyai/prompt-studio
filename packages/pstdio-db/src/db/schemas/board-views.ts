import { index, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { type BoardViewSettings, EMPTY_VIEW_FILTER } from "pstdio-api-contracts";
import type { ViewFilterGroup, ViewSort } from "pstdio-api-contracts/extension-kernel";
import { extension_instances } from "./extensions";
import { projects } from "./projects";

const boardScope = () => ({
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  extension_instance_id: text("extension_instance_id")
    .notNull()
    .references(() => extension_instances.id, { onDelete: "restrict" }),
  board_id: text("board_id").notNull(),
});

export const board_views = pgTable(
  "board_views",
  {
    id: text("id").primaryKey(),
    ...boardScope(),
    title: text("title").notNull(),
    settings: jsonb("settings").$type<BoardViewSettings>().notNull(),
    // The defaults fill rows that existed before views stored rules and sorts.
    filter: jsonb("filter").$type<ViewFilterGroup>().notNull().default(EMPTY_VIEW_FILTER),
    sorts: jsonb("sorts").$type<ViewSort[]>().notNull().default([]),
    sort_order: integer("sort_order").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    index("board_views_scope_order_idx").on(
      table.project_id,
      table.extension_instance_id,
      table.board_id,
      table.sort_order,
    ),
  ],
);

export const board_default_views = pgTable(
  "board_default_views",
  {
    ...boardScope(),
    default_view_id: text("default_view_id").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.project_id, table.extension_instance_id, table.board_id] })],
);
