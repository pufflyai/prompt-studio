import { Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import type { PlanSection } from "../contracts";

function estimateLabel(eta: PlanSection["eta"]) {
  if (!eta) return "ETA —";
  if (!eta.remainingMs) return "Done";
  const minutes = Math.ceil(eta.remainingMs / 60_000);
  if (minutes < 60) return `ETA ~${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `ETA ~${hours}h`;
  return `ETA ~${Math.ceil(hours / 24)}d`;
}

export function MilestoneEta(props: { eta: PlanSection["eta"] }) {
  const { eta } = props;
  let explanation = "An estimate needs a completed ticket and a recorded work start in the project.";
  if (eta) {
    explanation = `${eta.completedComplexity} of ${eta.totalComplexity} complexity points complete.`;
    if (eta.startedAt && eta.remainingMs) {
      explanation += ` Estimated time remaining for matching milestone tickets at the project's pace since ${new Date(eta.startedAt).toLocaleString()}. Includes time spent waiting.`;
    }
  }
  return (
    <Tooltip content={explanation}>
      <Text
        tabIndex={0}
        aria-label="Milestone estimate"
        textStyle="label/XS/medium"
        color="fg.muted"
        whiteSpace="nowrap"
        flexShrink="0"
      >
        {estimateLabel(eta)}
      </Text>
    </Tooltip>
  );
}
