import type { ActorRef } from "./attempt-types";

export type HumanRequestReason =
  | "approved-revision"
  | "ambiguous-dependency-attempt"
  | "divergent-dependency-attempts"
  | "dependency-cycle"
  | "dependency-missing"
  | "implementation-disconnected"
  | "review-disconnected"
  | "workspace-adoption-required";

export interface ReviewOption {
  id: string;
  label: string;
}

export interface ReviewQuestion {
  id: string;
  label: string;
  required: boolean;
  input:
    | { kind: "text" }
    | { kind: "single-choice"; options: ReviewOption[] }
    | { kind: "multiple-choice"; options: ReviewOption[] };
}

export type ReviewRequestBody = { kind: "task" } | { kind: "decision"; questions: ReviewQuestion[] };

export type ReviewResponse = { confirmed: true } | { answers: Record<string, string | string[]> };

// Requests are immutable. A correction cancels the request and creates another one.
export interface ReviewRequest {
  id: string;
  ticketId: string;
  title: string;
  instructions: string;
  request: ReviewRequestBody;
  requestedAt: string;
  requestedBy: ActorRef;
  context: {
    reason: HumanRequestReason | null;
    workspaceId: string | null;
    attemptRevision: number | null;
    sessionId: string;
    relatedSessionId: string | null;
  };
}

export type ReviewOutcome =
  | { kind: "answered"; at: string; by: ActorRef; response: ReviewResponse }
  | { kind: "cancelled"; at: string; by: ActorRef; reason: string };

// Stored under the request ID; the copy of the ID lets one list read join every outcome.
export type StoredReviewOutcome = ReviewOutcome & { requestId: string };

export type ReviewRequestState = "open" | "answered" | "cancelled";

export interface ReviewRequestView extends ReviewRequest {
  state: ReviewRequestState;
  outcome: ReviewOutcome | null;
  outcomeText: string | null;
}

export interface TicketReviewRequests {
  requests: ReviewRequestView[];
  // Unreadable stored records still need a person, so they count as pending input.
  errors: string[];
}
