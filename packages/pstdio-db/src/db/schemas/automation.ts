import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { isoTimestamp } from "./iso-timestamp";
import { projects } from "./projects";
import type { JsonObject } from "./types";

export type AutomationRunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "rejected";
export type AutomationRunError = { code: string; message: string; retryable: boolean };

export const automation_tokens = pgTable(
  "automation_tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    created_by: text("created_by").notNull(),
    token_prefix: text("token_prefix").notNull(),
    token_digest: text("token_digest").notNull(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    command_scopes_json: jsonb("command_scopes_json").$type<string[]>().notNull(),
    expires_at: isoTimestamp("expires_at").notNull(),
    last_used_at: isoTimestamp("last_used_at"),
    revoked_at: isoTimestamp("revoked_at"),
    created_at: isoTimestamp("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("automation_tokens_prefix_idx").on(table.token_prefix),
    index("automation_tokens_project_idx").on(table.project_id),
  ],
);

export const automation_runs = pgTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    project_id: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    principal: text("principal").notNull(),
    token_id: text("token_id").references(() => automation_tokens.id),
    command_id: text("command_id").notNull(),
    idempotency_key: text("idempotency_key").notNull(),
    input_hash: text("input_hash").notNull(),
    input_json: jsonb("input_json").$type<JsonObject>().notNull(),
    status: text("status").$type<AutomationRunStatus>().notNull(),
    result_json: jsonb("result_json").$type<unknown>(),
    error_json: jsonb("error_json").$type<AutomationRunError>(),
    created_at: isoTimestamp("created_at").notNull(),
    started_at: isoTimestamp("started_at"),
    finished_at: isoTimestamp("finished_at"),
  },
  (table) => [
    index("automation_runs_project_status_idx").on(table.project_id, table.status),
    uniqueIndex("automation_runs_idempotency_idx").on(
      table.principal,
      table.project_id,
      table.command_id,
      table.idempotency_key,
    ),
  ],
);
