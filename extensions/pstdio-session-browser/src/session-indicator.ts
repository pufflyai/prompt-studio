const icons: Record<string, string> = {
  pending: "circle-dashed",
  in_progress: "loader-circle",
  completed: "circle-check",
  failed: "circle-alert",
  cancelled: "circle-stop",
  disconnected: "circle-pause",
  queued: "clock-alert",
  awaiting_input: "circle-dot",
};
const colors: Record<string, string> = {
  pending: "fg.muted",
  in_progress: "fg.info",
  queued: "fg.info",
  completed: "fg.success",
  failed: "fg.error",
  cancelled: "fg.warning",
  disconnected: "fg.warning",
  awaiting_input: "fg.warning",
};
export const sessionDisplayStatus = (
  session?: { status: string; lastRequestStarted?: string | null; lastRequestEnded?: string | null } | null,
) => {
  if (!session) return "pending";
  return session.status === "completed" && session.lastRequestStarted === null && session.lastRequestEnded === null
    ? "pending"
    : session.status;
};
/** Palette/tab presentation matches the host session indicator, distinct from navigation-tree colors. */
export const sessionIndicator = (status: string) => ({
  icon: icons[status] ?? "circle-dashed",
  color: colors[status] ?? "fg.muted",
  label: `Session status: ${status}`,
});
