import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { bytea } from "./types";

export const document_snapshots = pgTable(
  "document_snapshots",
  {
    workbench_id: text("workbench_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hours: integer("hours").notNull(),
    captured_at: text("captured_at").notNull(),
    state: bytea("state").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workbench_id, table.hours] }),
    check("document_snapshots_hours", sql`${table.hours} in (1, 12, 24)`),
  ],
);
