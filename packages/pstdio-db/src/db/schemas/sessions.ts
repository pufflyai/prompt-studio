import { boolean, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sessionStatusEnum } from "./enums";
import { files } from "./files";
import { projects } from "./projects";
import type { ResourceRef } from "./types";

type HarnessParamsJson = Record<string, string | boolean>;

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  status: sessionStatusEnum("status").notNull().default("in_progress"),
  project_id: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  archived: boolean("archived").notNull().default(false),
  last_request_started: text("last_request_started"),
  last_request_ended: text("last_request_ended"),
  agent: text("agent"),
  last_selected_model: text("last_selected_model"),
  agent_session_id: text("agent_session_id"),
  session_file_id: text("session_file_id").references(() => files.id),
  original_session_id: text("original_session_id"),
  cwd: text("cwd"),
  params_json: jsonb("params_json").$type<HarnessParamsJson>(),
  anchors_json: jsonb("anchors_json").$type<ResourceRef[]>().notNull().default([]),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
