import type { AttemptReadinessResult } from "../data/attempt-readiness";

export interface NextTicket {
  id: string;
  ticket: string;
  title: string;
  action: "start" | "resume" | "update-stack" | "recover-workspace";
  baseHeadSha?: string;
  workspaceId?: string;
  recoveryHeadSha?: string;
  recoveryBaseSha?: string;
  detail?: string;
}

export interface WaitingTicket {
  id: string;
  ticket: string;
  title: string;
  reason:
    | Extract<AttemptReadinessResult, { decision: "wait" }>["reason"]
    | "assigned"
    | "review-gate"
    | "blocked"
    | "existing-attempt"
    | "workspace-unavailable";
  dependencyIds: string[];
  detail?: string;
}
