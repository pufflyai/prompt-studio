import { integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { tickets } from "./tickets";

export const ticket_tags = pgTable(
  "ticket_tags",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull().default("single_select"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [uniqueIndex("ticket_tags_project_name_idx").on(table.project_id, table.name)],
);

export const ticket_tag_options = pgTable(
  "ticket_tag_options",
  {
    id: text("id").primaryKey(),
    tag_id: text("tag_id")
      .notNull()
      .references(() => ticket_tags.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    icon: text("icon"),
    description: text("description"),
    sort_order: integer("sort_order").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [uniqueIndex("ticket_tag_options_tag_name_idx").on(table.tag_id, table.name)],
);

export const ticket_tag_assignments = pgTable(
  "ticket_tag_assignments",
  {
    id: text("id").primaryKey(),
    ticket_id: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    ticket_tag_option_id: text("ticket_tag_option_id")
      .notNull()
      .references(() => ticket_tag_options.id, { onDelete: "cascade" }),
    created_at: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("ticket_tag_assignments_ticket_option_idx").on(table.ticket_id, table.ticket_tag_option_id)],
);
