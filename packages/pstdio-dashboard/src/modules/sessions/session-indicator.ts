import { resolveSessionIndicatorColor, type SessionCompletionStatus } from "@pstdio/ui";

const sessionStatusIcon = (status: string | undefined) => {
  if (status === "in_progress") return "LoaderCircle";
  if (status === "completed") return "CircleCheck";
  if (status === "failed") return "CircleAlert";
  if (status === "cancelled") return "CircleStop";
  if (status === "disconnected") return "CirclePause";
  if (status === "queued") return "ClockAlert";
  if (status === "awaiting_input") return "CircleDot";
  return "CircleDashed";
};

export const createSessionIndicator = (status: string | undefined) => ({
  icon: sessionStatusIcon(status),
  color: resolveSessionIndicatorColor(status as SessionCompletionStatus | undefined),
  label: status ? `Session status: ${status}` : "Session status",
});
