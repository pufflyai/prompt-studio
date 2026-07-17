import { index, pgTable, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";

// Minimal host-owned projection of extension ticket data. The planner remains the
// source of truth; this table only makes query-tickets ancestry available to sync.
export const synced_tickets = pgTable(
  "synced_tickets",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    shorthand: text("shorthand").notNull(),
    title: text("title").notNull(),
    parent_id: text("parent_id"),
  },
  (table) => [index("synced_tickets_project_idx").on(table.project_id)],
);
