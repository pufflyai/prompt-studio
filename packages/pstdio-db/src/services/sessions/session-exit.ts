import type { DbClient } from "../../db/connection.pglite";
import { activity_events, type sessions } from "../../db/schemas.pg";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Session = Pick<
  typeof sessions.$inferSelect,
  "id" | "project_id" | "status" | "last_request_started" | "last_request_ended"
>;

export const insertSessionExit = async (tx: Transaction, session: Session, cause?: string) => {
  if (!session.project_id || !session.last_request_ended) return;
  const defaultCauses: Record<string, string> = {
    disconnected: "worker_lost",
    completed: "completed",
    failed: "failed",
  };
  const resolved = cause ?? defaultCauses[session.status] ?? "unknown";
  await tx.insert(activity_events).values({
    id: crypto.randomUUID(),
    project_id: session.project_id,
    resource_type: "session",
    resource_id: session.id,
    source_extension_id: null,
    event_type: "session_execution_ended",
    actor_type: "system",
    actor_id: null,
    source: "system",
    summary: `Execution ended: ${resolved}`,
    created_at: session.last_request_ended,
    payload_json: {
      cause: resolved,
      status: session.status,
      startedAt: session.last_request_started,
      endedAt: session.last_request_ended,
    },
  });
};
