import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readPlannerWorkspaceStatuses } from "@/features/ticket-list/data/api/planner";
import {
  plannerWorkspaceStatusDefinitionQueryKeys,
  projectAttemptStatusesQueryKey,
} from "@/shared/planner-workspace-statuses/query-keys";
import {
  type AttemptStatusResponse,
  createAttemptStatus,
  deleteAttemptStatus,
  setAttemptDefaultStatus,
  updateAttemptStatus,
} from "../data/attempt-statuses-api";

export interface AttemptStatusOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

const toOption = (row: {
  id: string;
  label: string;
  color?: string;
  sortOrder: number;
  isDefault: boolean;
}): AttemptStatusOption => ({
  id: row.id,
  name: row.label,
  color: row.color ?? "gray",
  sortOrder: row.sortOrder,
  isDefault: row.isDefault ?? false,
});

const useInvalidateWorkspaceStatuses = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      ...plannerWorkspaceStatusDefinitionQueryKeys(projectId).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
      queryClient.invalidateQueries({ queryKey: ["planner-workspace-statuses", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["planner-tickets", projectId] }),
    ]);
  };
};

export const useProjectAttemptStatuses = (projectId: string | undefined) =>
  useQuery({
    queryKey: projectAttemptStatusesQueryKey(projectId),
    queryFn: async () => {
      const data = await readPlannerWorkspaceStatuses(projectId!);
      return data.statuses.sort((a, b) => a.sortOrder - b.sortOrder).map(toOption);
    },
    enabled: Boolean(projectId),
  });

export const useCreateAttemptStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidateWorkspaceStatuses(projectId);
  return useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createAttemptStatus(projectId, input) as Promise<AttemptStatusResponse>;
    },
    onSuccess: invalidate,
  });
};

export const useUpdateAttemptStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidateWorkspaceStatuses(projectId);
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; color?: string; sort_order?: number }) => {
      if (!projectId) throw new Error("Project id is required.");
      const { id, ...rest } = input;
      return updateAttemptStatus(projectId, id, rest) as Promise<AttemptStatusResponse>;
    },
    onSuccess: invalidate,
  });
};

export const useSetDefaultAttemptStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidateWorkspaceStatuses(projectId);
  return useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await setAttemptDefaultStatus(projectId, id);
    },
    onSuccess: invalidate,
  });
};

export const useDeleteAttemptStatus = (projectId: string | undefined) => {
  const invalidate = useInvalidateWorkspaceStatuses(projectId);
  return useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteAttemptStatus(projectId, id);
    },
    onSuccess: invalidate,
  });
};
