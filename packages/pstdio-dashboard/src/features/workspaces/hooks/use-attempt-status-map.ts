import { useQuery } from "@tanstack/react-query";
import { readPlannerWorkspaceStatuses } from "@/features/ticket-list/data/api/planner";
import { attemptStatusMapQueryKey } from "@/shared/planner-workspace-statuses/query-keys";
import { buildAttemptStatusMap } from "./attempt-status-map";

export { buildAttemptStatusMap } from "./attempt-status-map";

export const useAttemptStatusMap = (projectId: string | undefined) => {
  const { data } = useQuery({
    queryKey: attemptStatusMapQueryKey(projectId),
    queryFn: () => readPlannerWorkspaceStatuses(projectId!),
    enabled: Boolean(projectId),
  });

  return buildAttemptStatusMap(data?.statuses);
};
