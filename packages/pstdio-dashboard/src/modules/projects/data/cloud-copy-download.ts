import type { ProjectCopyAccount } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

export const getCloudCopyDownloads = createRuntimeState((owner) => {
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).account;
  const domain = "project.download-device-copy";
  const state = (id: string) => {
    const { pending, recovery } = operations.getSnapshot();
    const active = pending.find((entry) => entry.domain === domain && entry.projectId === id);
    const failure = active && recovery.find((entry) => entry.id === active.id);
    return { active, failure };
  };

  return {
    state,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    check: operations.check,
    async start(id: string, name: string, expected: ProjectCopyAccount) {
      const authority = getDashboardScopedQueries(owner).getScope();
      if (authority.accountId !== expected.accountId || authority.accountOrigin !== expected.managerOrigin)
        throw new Error("The active Cloud account changed. Choose the project again.");
      if (state(id).active) throw new Error("This project's download is already being checked.");
      return operations.submit({
        projectId: id,
        domain,
        subjects: [operationSubject("device-project-copy", id)],
        sourceCommand: { id: dashboardCommandIds.openProjects },
        title: `Download ${name}`,
        classify: classifyApiWrite,
        write: (signal) => api.downloadCloudProject(id, { signal, expected }),
        async check(signal) {
          const catalog = await api.projectsCatalog({ signal });
          if (
            catalog.account?.accountId !== expected.accountId ||
            catalog.account.managerOrigin !== expected.managerOrigin
          )
            return { status: "unknown" };
          const project = catalog.projects.find(({ id: projectId }) => projectId === id);
          // A named project may have several copies. This runtime's catalog reports this device's copy.
          if (project?.presence === "downloaded")
            return { status: "confirmed", result: { projectId: id, presence: project.presence } };
          return { status: "unknown" };
        },
      }).result;
    },
  };
});
