import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";

type HarnessParamsJson = Record<string, string | boolean>;

export const session_queue_entries = pgTable(
  "session_queue_entries",
  {
    queue_position: integer("queue_position").generatedAlwaysAsIdentity().primaryKey(),
    session_id: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    request_kind: text("request_kind").notNull().default("start"),
    question_response_json: jsonb("question_response_json"),
    attachments_json: jsonb("attachments_json").$type<Array<{ file_id: string }>>(),
    params_json: jsonb("params_json").$type<HarnessParamsJson>(),
    dispatch_started_at: text("dispatch_started_at"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (table) => [index("session_queue_entries_session_id_idx").on(table.session_id)],
);
