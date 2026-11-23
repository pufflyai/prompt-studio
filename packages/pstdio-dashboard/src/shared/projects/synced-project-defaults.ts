import { getWorkbenchOperations } from "@pstdio/workbench";
import { useSyncExternalStore } from "react";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { createProjectDefaultOperations, type ProjectDefaultPatch } from "./project-default-operations";

export const getProjectDefaultOperations = createRuntimeState((owner) => {
  const api = getRuntimeApiClient(owner).projects;
  const operations = createProjectDefaultOperations({
    operations: getWorkbenchOperations(getDashboardScopedQueries(owner)),
    read: (projectId, signal) => api.get(projectId, { signal }),
    write: (projectId, patch, signal) => api.update(projectId, patch, { signal }),
  });
  const read = (projectId: string) => owner.getCollection("projects").state.get(projectId);
  return {
    ...operations,
    update(
      projectId: string,
      patch: ProjectDefaultPatch,
      confirm: (project: Awaited<ReturnType<typeof api.get>>) => void,
    ) {
      return operations.submit(projectId, patch, async (_saved, signal) => {
        const before = read(projectId);
        const confirmed = await api.get(projectId, { signal });
        signal.throwIfAborted();
        const current = read(projectId);
        if (current && current === before) {
          owner.getWriter("projects")?.upsert({
            ...current,
            default_agent_id: confirmed.default_agent_id,
            default_agent_model: confirmed.default_agent_model,
          });
        }
        // Preserve a project update the live stream delivered during the read.
        confirm(
          current && current !== before
            ? {
                ...confirmed,
                default_agent_id: (current.default_agent_id as string | null) ?? null,
                default_agent_model: (current.default_agent_model as string | null) ?? null,
              }
            : confirmed,
        );
      }).result;
    },
  };
});

export const useProjectedProjectDefaults = <T extends Required<ProjectDefaultPatch>>(
  projectId?: string,
  confirmed?: T,
) => {
  const operations = getProjectDefaultOperations();
  useSyncExternalStore(operations.subscribe, operations.snapshot, operations.snapshot);
  return operations.project(projectId, confirmed);
};
