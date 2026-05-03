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

export type ResourceRef = {
  type: string;
  id: string;
  projectId?: string;
  label?: string;
  extensionId?: string;
  metadata?: Record<string, unknown>;
};

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
  anchors_json: jsonb("anchors_json").$type<ResourceRef[]>().notNull().default([]),
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
    type: text("type").notNull().default("worktree"),
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

export const activity_events = pgTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    resource_type: text("resource_type").notNull(),
    resource_id: text("resource_id").notNull(),
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
  // Project-owned templates point at a stored file. Extension-owned templates
  // read content from their package asset on disk and leave file_id null.
  file_id: text("file_id").references(() => files.id),
  is_default: boolean("is_default").notNull().default(false),
  // When non-null, the row is an extension-owned default kept in sync with
  // `<PSTDIO_HOME>/extensions/<install>/...`. Look up the live asset by
  // (extension_id, template_key) against the runtime extension check.
  extension_id: text("extension_id"),
  template_key: text("template_key"),
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
  // When non-null, the row is an extension-owned default; (extension_id, skill_key)
  // resolves to a live package asset under `<PSTDIO_HOME>/extensions/...`.
  extension_id: text("extension_id"),
  skill_key: text("skill_key"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  deleted_at: text("deleted_at"),
});

export const installed_extension_sources = pgTable(
  "installed_extension_sources",
  {
    id: text("id").primaryKey(),
    install_name: text("install_name").notNull(),
    extension_id: text("extension_id").notNull(),
    namespace: text("namespace").notNull(),
    display_name: text("display_name").notNull(),
    version: text("version"),
    source_path: text("source_path").notNull(),
    source_kind: text("source_kind").notNull(),
    source_ref: text("source_ref"),
    manifest_json: jsonb("manifest_json").$type<Record<string, unknown>>().notNull().default({}),
    last_loaded_at: text("last_loaded_at"),
    last_error_json: jsonb("last_error_json").$type<Record<string, unknown>>(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("installed_extension_sources_install_name_idx").on(table.install_name),
    uniqueIndex("installed_extension_sources_source_path_idx").on(table.source_path),
  ],
);

export const project_extension_instances = pgTable(
  "project_extension_instances",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    installed_extension_id: text("installed_extension_id")
      .notNull()
      .references(() => installed_extension_sources.id, { onDelete: "restrict" }),
    extension_id: text("extension_id").notNull(),
    namespace: text("namespace").notNull(),
    display_name: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config_json: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
    diagnostics_json: jsonb("diagnostics_json").$type<Record<string, unknown>>(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("project_extension_instances_project_extension_idx").on(table.project_id, table.extension_id),
    uniqueIndex("project_extension_instances_project_namespace_idx").on(table.project_id, table.namespace),
    index("project_extension_instances_installed_idx").on(table.installed_extension_id),
  ],
);

export const extension_kv = pgTable(
  "extension_kv",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    namespace: text("namespace").notNull(),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    key: text("key").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.project_id, table.extension_id, table.scope_type, table.scope_id, table.key],
    }),
    index("extension_kv_project_extension_idx").on(table.project_id, table.extension_id),
    index("extension_kv_project_extension_scope_idx").on(
      table.project_id,
      table.extension_id,
      table.scope_type,
      table.scope_id,
    ),
  ],
);

export const extension_collection_items = pgTable(
  "extension_collection_items",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    namespace: text("namespace").notNull(),
    scope_type: text("scope_type").notNull(),
    scope_id: text("scope_id").notNull(),
    collection: text("collection").notNull(),
    item_id: text("item_id").notNull(),
    value_json: jsonb("value_json").$type<unknown>().notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.project_id,
        table.extension_id,
        table.scope_type,
        table.scope_id,
        table.collection,
        table.item_id,
      ],
    }),
    index("extension_collection_items_project_extension_collection_idx").on(
      table.project_id,
      table.extension_id,
      table.collection,
    ),
    index("extension_collection_items_project_extension_scope_collection_idx").on(
      table.project_id,
      table.extension_id,
      table.scope_type,
      table.scope_id,
      table.collection,
    ),
  ],
);

export const extension_template_preferences = pgTable(
  "extension_template_preferences",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    template_key: text("template_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.project_id, table.extension_id, table.template_key] })],
);

export const extension_skill_preferences = pgTable(
  "extension_skill_preferences",
  {
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    extension_id: text("extension_id").notNull(),
    skill_key: text("skill_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.project_id, table.extension_id, table.skill_key] })],
);

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
