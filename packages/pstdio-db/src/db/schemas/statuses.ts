import { boolean, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const ticket_statuses = pgTable(
  "ticket_statuses",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    sort_order: integer("sort_order").notNull(),
    is_default: boolean("is_default").notNull(),
    can_drag_out: boolean("can_drag_out").notNull(),
    can_drag_in: boolean("can_drag_in").notNull(),
    can_create: boolean("can_create").notNull(),
    column_actions: text("column_actions").notNull().default("[]"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [uniqueIndex("ticket_statuses_project_name_idx").on(table.project_id, table.name)],
);

export const attempt_statuses = pgTable(
  "attempt_statuses",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    sort_order: integer("sort_order").notNull(),
    is_default: boolean("is_default").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [uniqueIndex("attempt_statuses_project_name_idx").on(table.project_id, table.name)],
);
