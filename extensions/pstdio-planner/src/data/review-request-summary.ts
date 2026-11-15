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
  const open = group.requests.filter((request) => request.state === "open").length + group.errors.length;
  return reviewRequestCountSummary(total, open);
};

export const reviewRequestCountSummary = (total: number, open: number) => {
  if (total === 0) return null;
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
  return reviewSummaryBadgeItems(summary, action);
};

export const reviewSummaryBadgeItems = (
  summary: ReturnType<typeof reviewRequestCountSummary>,
  action: NavigationTarget,
) => {
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
