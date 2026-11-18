import type { TicketReviewRequests } from "./review-request-types";

export const isMergeOnlyInput = (request: { context: { affectedAction?: string; reason: string | null } }) =>
  request.context.affectedAction === "merge" || request.context.reason === "approved-revision";

export const hasPendingImplementationInput = (group: TicketReviewRequests, requireMergedDependencies = false) =>
  group.errors.length > 0 ||
  group.requests.some((request) => {
    const mergeOnly = isMergeOnlyInput(request);
    return request.state === "open" && (!mergeOnly || requireMergedDependencies);
  });
