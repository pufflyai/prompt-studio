import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { files } from "./files";
import { projects } from "./projects";
import { sessions } from "./sessions";
import type { ResourceRef } from "./types";

type JsonObject = Record<string, unknown>;

export type WorkspaceProviderRef = {
  version: number;
  data: JsonObject;
};

export type WorkspaceProviderState =
  | "provisioning"
  | "ready"
  | "failed"
  | "cancelled"
  | "archiving"
  | "archived"
  | "deleting"
  | "provider_missing";

export type WorkspaceCapabilities = {
  files: "none" | "read" | "write";
  diff: boolean;
  merge: boolean;
  rebase: boolean;
  archive: boolean;
  delete: boolean;
};

export const defaultLocalWorkspaceCapabilities: WorkspaceCapabilities = {
  files: "write",
  diff: true,
  merge: true,
  rebase: true,
  archive: true,
  delete: true,
};

export type WorkspaceProviderError = {
  code: string;
  message: string;
  retryable: boolean;
  occurred_at: string;
};

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
    // An unspecified workspace is a root checkout. Isolated worktrees are created only through
    // the provider flow, which always writes pstdio.worktree explicitly.
    provider_id: text("provider_id").notNull().default("pstdio.root"),
    provider_params_json: jsonb("provider_params_json").$type<JsonObject>().notNull().default({}),
    provider_ref_json: jsonb("provider_ref_json").$type<WorkspaceProviderRef>(),
    provider_state: text("provider_state").$type<WorkspaceProviderState>().notNull().default("ready"),
    execution_kind: text("execution_kind").$type<"local" | "remote">().notNull().default("local"),
    provider_operation_id: text("provider_operation_id"),
    provider_operation_kind: text("provider_operation_kind").$type<"create" | "cancel" | "archive" | "delete">(),
    provider_error_json: jsonb("provider_error_json").$type<WorkspaceProviderError>(),
    provider_capabilities_json: jsonb("provider_capabilities_json")
      .$type<WorkspaceCapabilities>()
      .notNull()
      .default(defaultLocalWorkspaceCapabilities),
    display_path: text("display_path"),
    // Marks the auto-created workspace that targets the project's root repo on
    // its current branch (no isolated worktree). At most one per project.
    is_default: boolean("is_default").notNull().default(false),
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
    uniqueIndex("workspaces_project_default_idx").on(table.project_id).where(sql`${table.is_default} = true`),
    uniqueIndex("workspaces_project_active_name_idx")
      .on(table.project_id, table.name)
      .where(sql`${table.archived} = false and ${table.deleted_at} is null`),
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
