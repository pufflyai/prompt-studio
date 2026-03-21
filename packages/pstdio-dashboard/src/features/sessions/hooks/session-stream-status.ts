import type { SessionStatus } from "../types";

type StreamActivity = "patch" | "approval_request";

export const resolveStatusOnStreamActivity = (activity: StreamActivity, currentStatus: SessionStatus | null) => {
  if (activity === "approval_request") {
    return "awaiting_input" as const;
  }

  if (currentStatus === "failed") {
    return "in_progress" as const;
  }

  return currentStatus;
};
