import type { CollectionBadgeItem, NavigationTarget } from "@pstdio/sdk/extensions";
import type { ReviewRequestView } from "./review-request-types";

export const REVIEW_REQUEST_ICON = "message-circle-warning";
export const REVIEW_REQUEST_ITEMS_ATTRIBUTE = "reviewRequestItems";

interface ReviewRequestStates {
  requests: readonly Pick<ReviewRequestView, "state">[];
  errors: readonly string[];
}

export const reviewRequestSummary = (group: ReviewRequestStates) => {
  const total = group.requests.length + group.errors.length;
  if (total === 0) return null;
  const open = group.requests.filter((request) => request.state === "open").length + group.errors.length;
  const count = open || total;
  const noun = count === 1 ? "item" : "items";
  const pendingTooltip = `${count} ${noun} ${count === 1 ? "needs" : "need"} attention`;
  return {
    count,
    color: open > 0 ? "orange" : "green",
    tooltip: open > 0 ? pendingTooltip : `${count} ${noun} resolved`,
  };
};

export const reviewRequestBadgeItems = (group: ReviewRequestStates, action: NavigationTarget) => {
  const summary = reviewRequestSummary(group);
  return summary
    ? [
        {
          id: "review-requests",
          label: String(summary.count),
          icon: REVIEW_REQUEST_ICON,
          color: summary.color,
          tooltip: summary.tooltip,
          action,
        } satisfies CollectionBadgeItem,
      ]
    : [];
};
