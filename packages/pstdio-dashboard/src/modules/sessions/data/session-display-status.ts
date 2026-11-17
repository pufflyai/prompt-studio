/** Empty saved conversations have no run to complete. Their persisted lifecycle stays idle. */
export const sessionDisplayStatus = (session: Record<string, unknown>) =>
  session.status === "completed" && session.last_request_started === null && session.last_request_ended === null
    ? "pending"
    : String(session.status ?? "unknown");
