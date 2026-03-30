import { useMutation } from "@tanstack/react-query";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import {
  type AttemptStatusResponse,
  createAttemptStatus,
  deleteAttemptStatus,
  updateAttemptStatus,
} from "../data/attempt-statuses-api";

export interface AttemptStatusOption {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

const toOption = (row: { id: string; [key: string]: unknown }): AttemptStatusOption => ({
  id: row.id,
  name: row.name as string,
  color: row.color as string,
  sortOrder: row.sort_order as number,
  isDefault: row.is_default as boolean,
});

export const useProjectAttemptStatuses = (projectId: string | undefined) => {
  const { data: rawData, isLoading } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ s: getCollection("attempt_statuses") })
            .where(({ s }) => eq(s.project_id, projectId))
            .select(({ s }) => ({ ...s }))
        : undefined,
    [projectId],
  );

  const rows = asSyncedRows(rawData);
  const data = rows?.map(toOption).sort((a, b) => a.sortOrder - b.sortOrder);

  return { data, isLoading };
};

export const useCreateAttemptStatus = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      return createAttemptStatus(projectId, input) as Promise<AttemptStatusResponse>;
    },
  });

export const useUpdateAttemptStatus = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: string;
      sort_order?: number;
      is_default?: boolean;
    }) => {
      if (!projectId) throw new Error("Project id is required.");
      const { id, ...rest } = input;
      return updateAttemptStatus(projectId, id, rest) as Promise<AttemptStatusResponse>;
    },
  });

export const useDeleteAttemptStatus = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteAttemptStatus(projectId, id);
    },
  });
