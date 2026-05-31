import { boolean, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { files } from "./files";
import { projects } from "./projects";
import { sessions } from "./sessions";
import { attempt_statuses } from "./statuses";
import { tickets } from "./tickets";
import type { ResourceRef } from "./types";

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    branch: text("branch"),
    worktree_path: text("worktree_path"),
    attempt_status_id: text("attempt_status_id").references(() => attempt_statuses.id, { onDelete: "set null" }),
    archived: boolean("archived").notNull().default(false),
    workspace_shorthand: text("workspace_shorthand").notNull(),
    initializing: boolean("initializing").notNull().default(false),
    setup_error: text("setup_error"),
    startup_log_file_id: text("startup_log_file_id").references(() => files.id, { onDelete: "set null" }),
    anchors_json: jsonb("anchors_json").$type<ResourceRef[]>().notNull().default([]),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("workspaces_project_workspace_shorthand_idx").on(table.project_id, table.workspace_shorthand),
  ],
);

/** @deprecated Legacy ticket-workspace link table. Ticket ownership is moving to the pstdio tickets extension. */
export const ticket_workspaces = pgTable(
  "ticket_workspaces",
  {
    id: text("id").primaryKey(),
    ticket_id: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    created_at: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("ticket_workspaces_ticket_workspace_idx").on(table.ticket_id, table.workspace_id),
    uniqueIndex("ticket_workspaces_workspace_idx").on(table.workspace_id),
  ],
);

export const workspace_sessions = pgTable(
  "workspace_sessions",
  {
    id: text("id").primaryKey(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    session_id: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    created_at: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("workspace_sessions_ws_session_idx").on(table.workspace_id, table.session_id)],
);

/** @deprecated Legacy ticket artifact table. Ticket artifacts are owned by the pstdio tickets extension. */
export const workspace_artifacts = pgTable(
  "workspace_artifacts",
  {
    id: text("id").primaryKey(),
    ticket_id: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    file_id: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    relative_path: text("relative_path").notNull(),
    created_at: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("workspace_artifacts_ticket_path_idx").on(table.ticket_id, table.relative_path)],
);
