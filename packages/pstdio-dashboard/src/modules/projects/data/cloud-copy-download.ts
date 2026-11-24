import type {
  CloudProjectCatalog,
  CloudProjectCatalogEntry,
  ProjectCopyAccount,
  ProjectSyncStatus,
} from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

import { cloudCatalogKeyFor, cloudCatalogScopeFor } from "./project-catalog";

export const cloudProjectCopySubject = (id: string) => operationSubject("cloud-project-copy", id);
export const cloudCopyScopeFor = (id: string, catalogScope: string) => JSON.stringify([id, catalogScope]);
export const cloudCopySyncKey = (scope: string) => ["cloud-project-opening", scope] as const;

export const cloudCopyDownloadAction = (entry?: CloudProjectCatalogEntry, syncState?: ProjectSyncStatus["state"]) => {
  if (!entry?.actions.download) return;
  if (entry.presence === "cloud-only") return "download";
  if (entry.presence === "downloading" && (entry.downloadError || syncState === "needs-attention")) return "retry";
};

export interface CloudCopyDownloadAdmission {
  id: string;
  account?: ProjectCopyAccount;
  scope: string;
  action: NonNullable<ReturnType<typeof cloudCopyDownloadAction>>;
}

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
    async start(admission: CloudCopyDownloadAdmission, onAdmitted: () => void) {
      const { id, account: expected, scope, action } = admission;
      const authority = getDashboardScopedQueries(owner).getScope();
      const login = getDashboardAccountStatusQuery(owner).getSnapshot().data?.login;
      if (
        !expected ||
        authority.accountId !== expected.accountId ||
        authority.accountOrigin !== expected.managerOrigin ||
        scope !== cloudCopyScopeFor(id, cloudCatalogScopeFor(String(owner.id), login))
      )
        return;
      const subject = cloudProjectCopySubject(id);
      if (state(id).failure || operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
        return;
      const queryKey = cloudCatalogKeyFor(expected.managerOrigin, expected.accountId, login?.deviceId);
      // Recovery can release the shared claim before a peer renders the confirmed catalog.
      const catalog = client.getQueryData<CloudProjectCatalog>(queryKey);
      if (!catalog || catalog.deletions.some((entry) => entry.projectId === id)) return;
      const project = catalog.projects.find((entry) => entry.id === id);
      const sync = client.getQueryData<ProjectSyncStatus>(cloudCopySyncKey(scope));
      if (!project || cloudCopyDownloadAction(project, sync?.state) !== action) return;
      const observe = async (signal: AbortSignal) => {
        const catalog = await api.projectsCatalog({ signal });
        if (
          catalog.account?.accountId !== expected.accountId ||
          catalog.account.managerOrigin !== expected.managerOrigin
        )
          throw new Error("The active Cloud account changed.");
        return { catalog, project: catalog.projects.find((entry) => entry.id === id) };
      };
      const name = project.name;
      const operation = operations.submit({
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
      });
      // The host may finish the download even if its response never reaches us.
      onAdmitted();
      return operation.result;
    },
  };
});
