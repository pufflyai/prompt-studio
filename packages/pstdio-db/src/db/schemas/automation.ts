import { integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import type { JsonObject } from "./types";

export type AutomationRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "rejected";
export type AutomationRunError = { code: string; message: string; retryable: boolean };

export const automation_principals = pgTable("automation_principals", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  created_by: text("created_by").notNull(),
  created_at: text("created_at").notNull(),
  disabled_at: text("disabled_at"),
});

export const automation_tokens = pgTable(
  "automation_tokens",
  {
    id: text("id").primaryKey(),
    principal_id: text("principal_id")
      .notNull()
      .references(() => automation_principals.id, { onDelete: "cascade" }),
    token_prefix: text("token_prefix").notNull(),
    token_digest: text("token_digest").notNull(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    command_scopes_json: jsonb("command_scopes_json").$type<string[]>().notNull(),
    expires_at: text("expires_at").notNull(),
    last_used_at: text("last_used_at"),
    revoked_at: text("revoked_at"),
    created_at: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("automation_tokens_prefix_idx").on(table.token_prefix)],
);

export const automation_runs = pgTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    principal_id: text("principal_id")
      .notNull()
      .references(() => automation_principals.id),
    token_id: text("token_id").references(() => automation_tokens.id),
    command_id: text("command_id").notNull(),
    idempotency_key: text("idempotency_key").notNull(),
    input_hash: text("input_hash").notNull(),
    input_json: jsonb("input_json").$type<JsonObject>().notNull(),
    status: text("status").$type<AutomationRunStatus>().notNull(),
    result_json: jsonb("result_json").$type<unknown>(),
    error_json: jsonb("error_json").$type<AutomationRunError>(),
    created_at: text("created_at").notNull(),
    started_at: text("started_at"),
    finished_at: text("finished_at"),
  },
  (table) => [
    uniqueIndex("automation_runs_idempotency_idx").on(
      table.principal_id,
      table.project_id,
      table.command_id,
      table.idempotency_key,
    ),
  ],
);

export const automation_run_events = pgTable("automation_run_events", {
  cursor: integer("cursor").primaryKey().generatedAlwaysAsIdentity(),
  run_id: text("run_id")
    .notNull()
    .references(() => automation_runs.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload_json: jsonb("payload_json").$type<JsonObject>().notNull(),
  created_at: text("created_at").notNull(),
});
