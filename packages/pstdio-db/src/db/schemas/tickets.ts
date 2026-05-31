import { boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { files } from "./files";
import { projects } from "./projects";
import { ticket_statuses } from "./statuses";

/** @deprecated Legacy core ticket table. Ticket data is owned by the pstdio tickets extension. */
export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    shorthand: text("shorthand").notNull(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    status_id: text("status_id").references(() => ticket_statuses.id, {
      onDelete: "set null",
    }),
    display_title: text("display_title"),
    user_prompt: text("user_prompt"),
    file_id: text("file_id").references(() => files.id, { onDelete: "set null" }),
    parallelizable: text("parallelizable"),
    parent_id: text("parent_id"),
    blocked_reason: text("blocked_reason"),
    depends_on: text("depends_on"),
    archived: boolean("archived").notNull().default(false),
    draft: boolean("draft").notNull().default(false),
    deleted_at: text("deleted_at"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("tickets_project_shorthand_idx").on(table.project_id, table.shorthand)],
);

/** @deprecated Legacy core ticket file link table. Ticket attachments are owned by the pstdio tickets extension. */
export const ticket_files = pgTable("ticket_files", {
  id: text("id").primaryKey(),
  ticket_id: text("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  file_id: text("file_id")
    .notNull()
    .references(() => files.id, { onDelete: "cascade" }),
  created_at: text("created_at").notNull(),
});
