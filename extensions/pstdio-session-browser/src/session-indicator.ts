import type { ExtensionSession } from "@pstdio/sdk/extensions";

type DisplayStatus = ExtensionSession["status"] | "pending";

const icons: Record<DisplayStatus, string> = {
  pending: "circle-dashed",
  in_progress: "loader-circle",
  completed: "circle-check",
  failed: "circle-alert",
  cancelled: "circle-stop",
  disconnected: "circle-pause",
  queued: "clock-alert",
  awaiting_input: "circle-dot",
};
const colors: Record<DisplayStatus, string> = {
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
  session: Pick<ExtensionSession, "status" | "lastRequestStarted" | "lastRequestEnded">,
): DisplayStatus => {
  return session.status === "completed" && session.lastRequestStarted === null && session.lastRequestEnded === null
    ? "pending"
    : session.status;
};
export const sessionIndicator = (status: DisplayStatus) => ({
  icon: icons[status],
  color: colors[status],
  label: `Session status: ${status}`,
});
