import { Box, Icon } from "@chakra-ui/react";
import { getIconComponent, Tooltip } from "@pstdio/ui";
import { CollectionBadge } from "@pstdio/ui/kanban-renderer";
import { REVIEW_REQUEST_ICON, reviewRequestSummary } from "../../data/review-request-summary";
import type { PlanRow } from "../contracts";

export function StatusIcon(props: { row: PlanRow }) {
  const { row } = props;
  const label = row.status?.name ?? "No status";
  const prerequisites = row.dependsOn.filter(({ done }) => !done).map(({ shorthand }) => shorthand);
  const tooltip = [label, prerequisites.length ? `Needs ${prerequisites.join(", ")}` : "", row.blockedReason ?? ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tooltip content={tooltip}>
      <Box
        as="span"
        role="img"
        aria-label={label}
        tabIndex={0}
        color={row.status?.color ? `${row.status.color}.fg` : "fg.muted"}
        display="inline-flex"
        flexShrink="0"
      >
        <Icon as={getIconComponent(row.status?.icon ?? "circle")} boxSize="4" />
      </Box>
    </Tooltip>
  );
}

export function ReviewStatusIcon(props: { row: PlanRow; onOpen?: () => void }) {
  const { row, onOpen } = props;
  const summary = reviewRequestSummary({ requests: row.requests, errors: row.requestErrors });
  if (!summary) return null;
  return (
    <CollectionBadge
      label={String(summary.count)}
      icon={REVIEW_REQUEST_ICON}
      color={summary.color}
      tooltip={summary.tooltip}
      onClick={onOpen}
    />
  );
}
