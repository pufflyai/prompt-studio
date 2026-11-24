import type { ProjectCopyAccount } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

import { cloudCatalogKeyFor } from "./project-catalog";

export const cloudProjectCopySubject = (id: string) => operationSubject("cloud-project-copy", id);

export const getCloudCopyDownloads = createRuntimeState((owner) => {
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).account;
  const client = getDashboardQueryClient(owner);
  const domain = "project.download-device-copy";
  const state = (id: string) => {
    const { pending, recovery } = operations.getSnapshot();
    const active = pending.find((entry) => entry.domain === domain && entry.projectId === id);
    const failure = recovery.find(
      (entry) => entry.domain === domain && entry.projectId === id && entry.status !== "rejected",
    );
    return { active, failure };
  };

  return {
    state,
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    check: operations.check,
    discard(id: string, attempt: symbol) {
      if (state(id).failure?.id === attempt) operations.discard(attempt);
    },
    async start(id: string, name: string, expected: ProjectCopyAccount) {
      const authority = getDashboardScopedQueries(owner).getScope();
      if (authority.accountId !== expected.accountId || authority.accountOrigin !== expected.managerOrigin)
        throw new Error("The active Cloud account changed. Choose the project again.");
      const subject = cloudProjectCopySubject(id);
      if (state(id).failure || operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
        throw new Error("This project already has a pending Cloud change.");
      const login = getDashboardAccountStatusQuery(owner).getSnapshot().data?.login;
      const queryKey = cloudCatalogKeyFor(expected.managerOrigin, expected.accountId, login?.deviceId);
      const observe = async (signal: AbortSignal) => {
        const catalog = await api.projectsCatalog({ signal });
        if (
          catalog.account?.accountId !== expected.accountId ||
          catalog.account.managerOrigin !== expected.managerOrigin
        )
          throw new Error("The active Cloud account changed.");
        return { catalog, project: catalog.projects.find((entry) => entry.id === id) };
      };
      return operations.submit({
        projectId: id,
        domain,
        subjects: [subject],
        sourceCommand: { id: dashboardCommandIds.openProjects },
        recoverySource: "cloud-project-picker",
        title: `Download ${name}`,
        draft: { projectId: id, name },
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        write: (signal) => api.downloadCloudProject(id, { signal, expected }),
        async reconcile(receipt, signal) {
          const { catalog, project } = await observe(signal);
          const ready = project?.presence === "downloaded";
          const admitted = receipt.presence === "downloading" && project?.presence === "downloading";
          if (!ready && !admitted) throw new Error("The device catalog is still checking this copy.");
          await client.cancelQueries({ queryKey, exact: true });
          signal.throwIfAborted();
          client.setQueryData(queryKey, (previous: typeof catalog | undefined) => {
            if (!previous) return catalog;
            return { ...previous, projects: previous.projects.map((entry) => (entry.id === id ? project! : entry)) };
          });
        },
        async check(signal) {
          const { project } = await observe(signal);
          if (project?.presence === "downloaded" || project?.presence === "downloading")
            return { status: "confirmed", result: { projectId: id, presence: project.presence } };
          if (project?.downloadError) return { status: "rejected", error: new Error(project.downloadError) };
          return { status: "unknown" };
        },
      }).result;
    },
  };
});
