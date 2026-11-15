import type { TicketReviewRequests } from "./review-request-types";
import type { TicketInputState } from "./ticket-input-state";

export const isMergeOnlyInput = (request: { context: { affectedAction?: string; reason: string | null } }) =>
  request.context.affectedAction === "merge" || request.context.reason === "approved-revision";

export const hasPendingImplementationInput = (
  group: TicketReviewRequests | TicketInputState,
  requireMergedDependencies = false,
) => {
  if ("pending" in group) return requireMergedDependencies ? group.pending : group.pendingImplementation;
  return (
    group.errors.length > 0 ||
    group.requests.some((request) => {
      const mergeOnly = isMergeOnlyInput(request);
      return request.state === "open" && (!mergeOnly || requireMergedDependencies);
    })
  );
};
