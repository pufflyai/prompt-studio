import type { JsonObject } from "@pstdio/sdk/extensions";

export type AttemptState =
  | "implementing"
  | "review_ready"
  | "reviewing"
  | "approved"
  | "changes_requested"
  | "blocked"
  | "abandoned";

export interface ActorRef {
  type: "human" | "agent" | "automation";
  id: string;
  displayName: string;
  harnessId?: string;
  model?: string;
}

export interface AttemptReview {
  id: string;
  sessionId: string | null;
  reportId: string | null;
  reviewedHeadSha: string;
  reviewer: ActorRef;
  state: "started" | "submitted" | "disconnected" | "failed" | "dismissed";
  verdict: "passed" | "changes_requested" | null;
  startedAt: string;
  completedAt: string | null;
  supersedesReviewId: string | null;
}

export interface AttemptRevision {
  revision: number;
  baseSha: string;
  headSha: string;
  changeRequestReportId: string;
  submittedAt: string;
  submittedBy: ActorRef;
  reviews: AttemptReview[];
}

export interface AttemptBlocker {
  phase: "implementation" | "review" | "workspace_setup";
  reason: string;
  sessionId: string | null;
  retryCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}

export interface AttemptRecord {
  schemaVersion: 1;
  workspaceId: string;
  workspaceShorthand: string;
  ticketId: string;
  ticketShorthand: string;
  implementationSessionId: string;
  state: AttemptState;
  base: { workspaceId: string | null; headSha: string };
  revisions: AttemptRevision[];
  implementationDisconnectRetries: number;
  reviewDisconnectRetries: number;
  blocker: AttemptBlocker | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewThread {
  id: string;
  workspaceId: string;
  revision: number;
  reviewId: string;
  path: string | null;
  startLine: number | null;
  endLine: number | null;
  side: "base" | "head" | null;
  originalBaseSha: string;
  originalHeadSha: string;
  severity: "critical" | "minor" | "suggestion";
  state: "open" | "resolved" | "outdated";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: ActorRef | null;
}

export interface ReviewComment {
  id: string;
  reviewId: string;
  threadId: string;
  author: ActorRef;
  body: string;
  replyToCommentId: string | null;
  createdAt: string;
  editedAt: string | null;
}

export interface TicketAttemptSelection {
  ticketId: string;
  workspaceId: string;
  selectedBy: ActorRef;
  humanRequestId: string | null;
  selectedAt: string;
}

export interface AttemptLaunchClaim {
  ticketId: string;
  ownerRunId: string;
  createdAt: string;
  expiresAt: string;
}

export interface ReviewLaunchClaim {
  workspaceId: string;
  revision: number;
  reviewId: string;
  createdAt: string;
}

export type HumanRequestReason =
  | "approved-revision"
  | "ambiguous-dependency-attempt"
  | "divergent-dependency-attempts"
  | "dependency-cycle"
  | "dependency-missing"
  | "implementation-disconnected"
  | "review-disconnected"
  | "workspace-adoption-required";

export interface HumanRequestRecord {
  id: string;
  ticketId: string;
  workspaceId: string | null;
  revision: number | null;
  sessionId: string;
  relatedSessionId: string | null;
  reason: HumanRequestReason;
  question: string;
  expectedAction: string;
  state: "open" | "resolved";
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: ActorRef | null;
  resolution: string | null;
}

export type AttemptEventType =
  | "attempt_started"
  | "revision_submitted"
  | "review_started"
  | "review_submitted"
  | "review_disconnected"
  | "review_retried"
  | "review_dismissed"
  | "thread_created"
  | "comment_added"
  | "thread_resolved"
  | "thread_outdated"
  | "implementation_resumed"
  | "attempt_selected"
  | "attempt_blocked"
  | "attempt_abandoned"
  | "attempt_merged";

export interface AttemptTimelineEvent {
  id: string;
  workspaceId: string;
  revision: number | null;
  type: AttemptEventType;
  actor: ActorRef;
  sessionId: string | null;
  reportId: string | null;
  reviewId: string | null;
  threadId: string | null;
  commitSha: string | null;
  createdAt: string;
  metadata: JsonObject;
}
