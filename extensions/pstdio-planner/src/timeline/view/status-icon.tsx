// Render exactly one accessible state icon with its source workflow and prerequisite tooltip.
import { Box, Icon } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { Ban, CheckCircle2, Circle, LoaderCircle, UserCheck, UserRound } from "lucide-react";
import type { PlanRow } from "../contracts";

const states = {
  "await-input": { label: "Await input", icon: UserRound, color: "orange.fg" },
  "input-received": { label: "Input received", icon: UserCheck, color: "green.fg" },
  done: { label: "Done", icon: CheckCircle2, color: "green.fg" },
  "not-started": { label: "Not started", icon: Circle, color: "fg.muted" },
  "in-progress": { label: "In progress", icon: LoaderCircle, color: "blue.fg" },
  blocked: { label: "Blocked", icon: Ban, color: "red.fg" },
};

export function StatusIcon(props: { row: PlanRow }) {
  const { row } = props;
  const state = states[row.state];
  const prerequisites = row.dependsOn.filter(({ done }) => !done).map(({ shorthand }) => shorthand);
  const tooltip = [
    state.label,
    row.status !== state.label ? `Planner: ${row.status}` : "",
    prerequisites.length ? `Needs ${prerequisites.join(", ")}` : "",
    row.blockedReason ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Tooltip content={tooltip}>
      <Box
        as="span"
        role="img"
        aria-label={state.label}
        tabIndex={0}
        color={state.color}
        display="inline-flex"
        flexShrink="0"
      >
        <Icon as={state.icon} boxSize="16px" />
      </Box>
    </Tooltip>
  );
}
