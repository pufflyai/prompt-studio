import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "awaiting_input",
  "completed",
  "failed",
  "cancelled",
  "disconnected",
]);

export const activityActorTypeEnum = pgEnum("activity_actor_type", ["user", "agent", "system"]);
export const activitySourceEnum = pgEnum("activity_source", ["ui", "api", "hook", "system", "agent"]);

export type ActivityResourceRef = {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  role?: "primary" | "context" | "source" | "result";
  metadata?: Record<string, unknown>;
};

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shorthand: text("shorthand").notNull(),
  selected_agents: text("selected_agents").notNull().default("[]"),
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

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: sessionStatusEnum("status").notNull().default("in_progress"),
  project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  archived: boolean("archived").notNull().default(false),
  last_request_started: text("last_request_started"),
  last_request_ended: text("last_request_ended"),
  agent: text("agent"),
  agent_session_id: text("agent_session_id"),
  session_file_id: text("session_file_id").references(() => files.id),
  original_session_id: text("original_session_id"),
  cwd: text("cwd"),
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
    branch: text("branch"),
    worktree_path: text("worktree_path"),
    attempt_status_id: text("attempt_status_id").references(() => attempt_statuses.id, { onDelete: "set null" }),
    archived: boolean("archived").notNull().default(false),
    workspace_shorthand: text("workspace_shorthand").notNull(),
    anchors_json: jsonb("anchors_json").$type<ActivityResourceRef[]>().notNull().default([]),
    initializing: boolean("initializing").notNull().default(false),
    setup_error: text("setup_error"),
    startup_log_file_id: text("startup_log_file_id").references(() => files.id, { onDelete: "set null" }),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
    deleted_at: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("workspaces_project_workspace_shorthand_idx").on(table.project_id, table.workspace_shorthand),
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

export const activity_events = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    resource_type: text("resource_type").notNull(),
    resource_id: text("resource_id").notNull(),
    target_ref_json: jsonb("target_ref_json").$type<ActivityResourceRef>().notNull(),
    related_refs_json: jsonb("related_refs_json").$type<ActivityResourceRef[]>().notNull().default([]),
    source_extension_id: text("source_extension_id"),
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
  ],
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

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  file_id: text("file_id").references(() => files.id, { onDelete: "set null" }),
  files_json: text("files_json").notNull().default("[]"),
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
