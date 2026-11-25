import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { BoardViewSettings } from "pstdio-api-contracts";
import type { ViewFilterGroup, ViewSort } from "pstdio-api-contracts/extension-kernel";
import { projects } from "./projects";

const boardScope = () => ({
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  extension_id: text("extension_id"),
  board_id: text("board_id").notNull(),
});

export const board_views = pgTable(
  "board_views",
  {
    id: text("id").primaryKey(),
    is_default: boolean("is_default").notNull().default(false),
    ...boardScope(),
    title: text("title").notNull(),
    settings: jsonb("settings").$type<BoardViewSettings>().notNull(),
    filter: jsonb("filter").$type<ViewFilterGroup>().notNull(),
    sorts: jsonb("sorts").$type<ViewSort[]>().notNull().default([]),
    sort_order: integer("sort_order").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("board_views_default_scope_idx")
      .on(table.project_id, sql`coalesce(${table.extension_id}, '')`, table.board_id)
      .where(sql`${table.is_default} = true`),
    index("board_views_scope_order_idx").on(table.project_id, table.extension_id, table.board_id, table.sort_order),
  ],
);
