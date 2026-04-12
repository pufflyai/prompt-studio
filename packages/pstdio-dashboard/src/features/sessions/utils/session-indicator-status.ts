import type { SessionCompletionStatus } from "@pstdio/ui";
import type { SessionStatus } from "../types";

export const toSessionIndicatorStatus = (status: SessionStatus | null): SessionCompletionStatus | undefined => {
  if (status === "cancelled") return undefined;
  if (!status) return undefined;
  return status;
};
