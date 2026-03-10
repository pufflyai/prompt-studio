import { useMutation } from "@tanstack/react-query";
import { asSyncedRows, getCollection, type SyncedRow, useLiveQuery } from "@/features/sync/collections";
import { createProject, deleteProject } from "../data/api";
import type { ProjectListItem } from "../types";

const toProjectListItem = (row: SyncedRow): ProjectListItem => ({
  id: row.id,
  name: row.name as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
});

export const useProjectList = () => {
  const { data: rawRows, isLoading } = useLiveQuery((q) =>
    q.from({ p: getCollection("projects") }).select(({ p }) => ({ ...p })),
  );
  const rows = asSyncedRows(rawRows);

  const data = rows
    ? [...rows].map(toProjectListItem).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : undefined;

  return { data, isLoading };
};

export const useCreateProject = () => useMutation({ mutationFn: createProject });

export const useDeleteProject = () =>
  useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      await deleteProject(projectId);
    },
  });
