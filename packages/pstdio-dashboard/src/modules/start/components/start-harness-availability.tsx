import { useAgents } from "@/shared/agents/use-agents";
import { StartHarnessStatus } from "./start-harness-status";

interface StartHarnessAvailabilityProps {
  projectId: string;
  onReviewExtensions: () => void;
}

export const StartHarnessAvailability = (props: StartHarnessAvailabilityProps) => {
  const { projectId, onReviewExtensions } = props;
  const availability = useAgents(projectId);

  return (
    <StartHarnessStatus
      agents={availability.data ?? []}
      isPending={availability.isPending}
      isFetching={availability.isFetching}
      isError={availability.isError}
      onReviewExtensions={onReviewExtensions}
      onCheckAgain={() => void availability.refetch()}
    />
  );
};
