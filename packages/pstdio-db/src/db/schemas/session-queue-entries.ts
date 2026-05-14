import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";

export const session_queue_entries = pgTable("session_queue_entries", {
  session_id: text("session_id")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  queue_position: integer("queue_position").generatedAlwaysAsIdentity().notNull(),
  prompt: text("prompt").notNull(),
  request_kind: text("request_kind").notNull().default("start"),
  question_response_json: jsonb("question_response_json"),
  dispatch_started_at: text("dispatch_started_at"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});
