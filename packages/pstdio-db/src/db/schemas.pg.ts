import { boolean, customType, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shorthand: text("shorthand").notNull(),
  startup_script: text("startup_script"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const repos = pgTable("repos", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  display_name: text("display_name"),
  path: text("path").notNull(),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const project_repos = pgTable("project_repos", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  repo_id: text("repo_id")
    .notNull()
    .references(() => repos.id, { onDelete: "cascade" }),
  created_at: text("created_at").notNull(),
});

export const agent_configs = pgTable(
  "agent_configs",
  {
    id: text("id").primaryKey(),
    agent_id: text("agent_id").notNull(),
    is_default: boolean("is_default").notNull().default(false),
    config: text("config").notNull().default("{}"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("agent_configs_agent_id_idx").on(table.agent_id)],
);

export const ticket_statuses = pgTable("ticket_statuses", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  sort_order: integer("sort_order").notNull(),
  is_default: boolean("is_default").notNull(),
  is_open: boolean("is_open").notNull().default(true),
  can_drag_out: boolean("can_drag_out").notNull(),
  can_drag_in: boolean("can_drag_in").notNull(),
  can_create: boolean("can_create").notNull(),
  can_attempt_on_drop: boolean("can_attempt_on_drop").notNull(),
  column_actions: text("column_actions").notNull().default("[]"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

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
    title: text("title"),
    input: text("input"),
    priority: text("priority"),
    parallelizable: text("parallelizable"),
    complexity: text("complexity"),
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

export const ticket_tags = pgTable(
  "ticket_tags",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [uniqueIndex("ticket_tags_project_name_idx").on(table.project_id, table.name)],
);

export const ticket_tag_assignments = pgTable(
  "ticket_tag_assignments",
  {
    id: text("id").primaryKey(),
    ticket_id: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    ticket_tag_id: text("ticket_tag_id")
      .notNull()
      .references(() => ticket_tags.id, { onDelete: "cascade" }),
    created_at: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("ticket_tag_assignments_ticket_tag_idx").on(table.ticket_id, table.ticket_tag_id)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status", { enum: ["in_progress", "awaiting_input", "completed", "failed", "cancelled"] })
    .notNull()
    .default("in_progress"),
  project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  archived: boolean("archived").notNull().default(false),
  created: text("created"),
  last_request_started: text("last_request_started"),
  last_request_ended: text("last_request_ended"),
  agent: text("agent"),
  agent_session_id: text("agent_session_id"),
  session_file_id: text("session_file_id").references(() => files.id),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    session_id: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    branch: text("branch"),
    worktree_path: text("worktree_path"),
    status: text("status", { enum: ["active", "merged", "rejected"] })
      .notNull()
      .default("active"),
    archived: boolean("archived").notNull().default(false),
    workspace_shorthand: text("workspace_shorthand").notNull(),
    startup_log_file_id: text("startup_log_file_id").references(() => files.id, { onDelete: "set null" }),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("workspaces_project_workspace_shorthand_idx").on(table.project_id, table.workspace_shorthand),
  ],
);

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

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  file_name: text("file_name").notNull(),
  file_kind: text("file_kind").notNull(),
  storage_path: text("storage_path").notNull(),
  mime_type: text("mime_type"),
  size_bytes: integer("size_bytes").notNull(),
  hash: text("hash"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

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

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  project_id: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  template_type: text("template_type").notNull(),
  file_id: text("file_id")
    .notNull()
    .references(() => files.id),
  is_default: boolean("is_default").notNull().default(false),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const ydocUpdates = pgTable("ydoc_updates", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  room: text("room").notNull(),
  op: bytea("op").notNull(),
});

export const ydocAwareness = pgTable(
  "ydoc_awareness",
  {
    clientId: text("client_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    room: text("room").notNull(),
    op: bytea("op").notNull(),
    updated: text("updated").notNull(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.room, t.projectId] })],
);

export const ydocResumeState = pgTable(
  "ydoc_resume_state",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    room: text("room").notNull(),
    offset: text("offset").notNull(),
    handle: text("handle").notNull(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.room] })],
);
