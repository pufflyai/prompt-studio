import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { SessionMessageSender } from "pstdio-api-contracts";
import { isoTimestamp } from "./iso-timestamp";
import { sessions } from "./sessions";

type HarnessParamsJson = Record<string, string | boolean>;

export const session_queue_entries = pgTable(
  "session_queue_entries",
  {
    queue_position: integer("queue_position").generatedAlwaysAsIdentity().primaryKey(),
    session_id: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    model: text("model"),
    steering_delivery_json: jsonb("steering_delivery_json").$type<{ id: string; runStartedAt: string }>(),
    revision: text("revision").notNull(),
    prompt: text("prompt").notNull(),
    sender_json: jsonb("sender_json").$type<SessionMessageSender & { afterTurn?: number; runStartedAt?: string }>(),
    request_kind: text("request_kind").notNull().default("start"),
    question_response_json: jsonb("question_response_json"),
    attachments_json: jsonb("attachments_json").$type<Array<{ file_id: string }>>(),
    params_json: jsonb("params_json").$type<HarnessParamsJson>(),
    dispatch_started_at: isoTimestamp("dispatch_started_at"),
    created_at: isoTimestamp("created_at").notNull(),
    updated_at: isoTimestamp("updated_at").notNull(),
  },
  (table) => [index("session_queue_entries_session_id_idx").on(table.session_id)],
);
