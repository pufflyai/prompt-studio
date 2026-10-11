import { Box, Icon } from "@chakra-ui/react";
import { getIconComponent, Tooltip } from "@pstdio/ui";
import { UserCheck, UserRound } from "lucide-react";
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

export function ReviewStatusIcon(props: { row: PlanRow }) {
  const { row } = props;
  const pending =
    row.requestErrors.length > 0 ||
    row.requests.some((request) => request.state === "open") ||
    row.flags.includes("human-needed");
  const answered = row.requests.some((request) => request.state === "answered");
  if (!pending && !answered) return null;
  const label = pending ? "Review requested" : "Review answered";
  return (
    <Tooltip content={label}>
      <Box
        as="span"
        role="img"
        aria-label={label}
        tabIndex={0}
        color={pending ? "orange.fg" : "green.fg"}
        display="inline-flex"
        flexShrink="0"
      >
        <Icon as={pending ? UserRound : UserCheck} boxSize="4" />
      </Box>
    </Tooltip>
  );
}
