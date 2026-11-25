import type {
  CloudProjectCatalog,
  CloudProjectCatalogEntry,
  ProjectCopyAccount,
  ProjectSyncStatus,
} from "@pstdio/sdk/client";
import {
  classifyApiWrite,
  getWorkbenchOperations,
  operationSubject,
  type WorkbenchOperations,
} from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { createRuntimeFeed, createRuntimeState } from "@/lib/sync/runtime-state";
import { dashboardCommandIds } from "@/shared/app/commands";

import { cloudCatalogKeyFor, cloudCatalogScopeFor, cloudProjectDeletionKey } from "./project-catalog";

const downloadDomain = "project.download-device-copy";
export const cloudCopyRemovalDomain = "project.remove-device-copy";
export const cloudProjectCopySubject = (id: string, scope?: string) => {
  const subject = operationSubject("cloud-project-copy", id);
  return scope ? `${subject}:${scope}` : subject;
};
export const cloudCopyBusy = (operations: WorkbenchOperations, id: string, scope?: string) => {
  const accountSubject = cloudProjectCopySubject(id);
  const deviceSubject = scope && cloudProjectCopySubject(id, scope);
  return operations.getSnapshot().pending.some((entry) => {
    if (entry.subjects.includes(accountSubject)) return true;
    if (deviceSubject) return entry.subjects.includes(deviceSubject);
    // An account-wide deletion must check copy claims on every device.
    return entry.subjects.some((subject) => subject.startsWith(`${accountSubject}:`));
  });
};
export const cloudCopyScopeFor = (id: string, catalogScope: string) => JSON.stringify([id, catalogScope]);
export const cloudCopySyncKey = (scope: string) => ["cloud-project-opening", scope] as const;

export const cloudCopyDownloadAction = (entry?: CloudProjectCatalogEntry, sync?: ProjectSyncStatus) => {
  if (!entry?.actions.download) return;
  if (entry.presence === "cloud-only") return entry;
  if (entry.presence !== "downloading") return;
  if (entry.downloadError) return entry;
  if (sync?.state === "needs-attention" || sync?.sources?.some((source) => source.error)) return sync;
};

export interface CloudCopyDownloadAdmission {
  id: string;
  account?: ProjectCopyAccount;
  scope: string;
  action: NonNullable<ReturnType<typeof cloudCopyDownloadAction>>;
}

const progressedRetry = async (
  project: CloudProjectCatalogEntry,
  action: CloudCopyDownloadAdmission["action"],
  readSync: () => Promise<ProjectSyncStatus>,
) => {
  if (!project.online) return false;
  if ("presence" in action) return Boolean(action.downloadError && !project.downloadError);
  if (project.downloadError) return false;
  const { state, sources } = await readSync();
  if (sources?.some((source) => source.error)) return false;
  return state === "first-download-incomplete" || state === "waiting-to-sync" || state === "synced";
};

const localCopyRemovals = createRuntimeFeed<string>();

export const getCloudCopyDownloads = createRuntimeState((owner) => {
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).account;
  const client = getDashboardQueryClient(owner);
  const accountStatus = getDashboardAccountStatusQuery(owner);
  const isCheckingAccount = () => accountStatus.getSnapshot().fetching;
  const isCurrent = (id: string, scope: string) => {
    if (owner.isDisposed() || getRuntimeCollections() !== owner) return false;
    const { data, error } = accountStatus.getSnapshot();
    // A failed read retains the previous login, but it cannot confirm the current device.
    return !error && scope === cloudCopyScopeFor(id, cloudCatalogScopeFor(String(owner.id), data?.login));
  };
  const state = (id: string, scope: string) => {
    const { pending, recovery } = operations.getSnapshot();
    const subject = cloudProjectCopySubject(id, scope);
    const matches = (entry: { domain: string; subjects: readonly string[] }) =>
      entry.domain === downloadDomain && entry.subjects.includes(subject);
    const active = pending.find(matches);
    const failure = recovery.find((entry) => matches(entry) && entry.status !== "rejected");
    return { active, failure };
  };

  return {
    isCurrent,
    isCheckingAccount,
    state,
    subscribeToLocalRemoval: (listener: (scope: string) => void) => localCopyRemovals.subscribe(listener, owner),
    localCopyRemoved: (scope: string) => localCopyRemovals.publish(scope, owner),
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    check: operations.check,
    discard(id: string, scope: string, attempt: symbol) {
      if (isCheckingAccount() || !isCurrent(id, scope) || state(id, scope).failure?.id !== attempt) return false;
      operations.discard(attempt);
      return true;
    },
    async start(admission: CloudCopyDownloadAdmission, onAdmitted: () => void) {
      const { id, account: expected, scope, action } = admission;
      if (!expected || !isCurrent(id, scope) || isCheckingAccount()) return;
      const authority = getDashboardScopedQueries(owner).getScope();
      const login = accountStatus.getSnapshot().data?.login;
      if (authority.accountId !== expected.accountId || authority.accountOrigin !== expected.managerOrigin) return;
      const subject = cloudProjectCopySubject(id, scope);
      if (cloudCopyBusy(operations, id, scope)) return;
      const queryKey = cloudCatalogKeyFor(expected.managerOrigin, expected.accountId, login?.deviceId);
      const syncKey = cloudCopySyncKey(scope);
      // Recovery can release the shared claim before a peer renders the confirmed catalog.
      const catalog = client.getQueryData<CloudProjectCatalog>(queryKey);
      if (!catalog || catalog.deletions.some((entry) => entry.projectId === id)) return;
      if (client.getQueryData(cloudProjectDeletionKey(id, expected))) return;
      const project = catalog.projects.find((entry) => entry.id === id);
      const sync = client.getQueryData<ProjectSyncStatus>(syncKey);
      if (!project || cloudCopyDownloadAction(project, sync) !== action) return;
      const retry = project.presence === "downloading";
      const clearRetriedFailure = (observed?: CloudProjectCatalogEntry) => {
        const sync = client.getQueryCache().find<ProjectSyncStatus>({ queryKey: syncKey, exact: true });
        if (sync?.state.data?.state === "needs-attention" || sync?.state.data === action) sync?.reset();
        if ("presence" in action && action.downloadError && observed?.downloadError === action.downloadError) {
          client.setQueryData<CloudProjectCatalog>(
            queryKey,
            (previous) =>
              previous && {
                ...previous,
                projects: previous.projects.map((entry) =>
                  entry.id === id ? { ...entry, downloadError: undefined } : entry,
                ),
              },
          );
        }
      };
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
      const waitForCurrentDevice = async (signal: AbortSignal) => {
        if (isCheckingAccount()) await accountStatus.read(signal);
        return isCurrent(id, scope);
      };
      const retired = new Error("The active Cloud device changed.");
      const operation = operations.submit({
        projectId: id,
        domain: downloadDomain,
        subjects: [subject],
        sourceCommand: { id: dashboardCommandIds.openProjects },
        recoverySource: "cloud-project-picker",
        title: `Download ${name}`,
        draft: { projectId: id, name },
        releaseOnDiscard: true,
        classify: (error) => (error === retired ? "rejected" : classifyApiWrite(error)),
        async write(signal) {
          if (!(await waitForCurrentDevice(signal))) throw retired;
          return api.downloadCloudProject(id, { signal, expected });
        },
        async reconcile(receipt, signal) {
          if (!isCurrent(id, scope)) return;
          const { catalog, project } = await observe(signal);
          if (!(await waitForCurrentDevice(signal))) return;
          const ready = project?.presence === "downloaded";
          const admitted = receipt.presence === "downloading" && project?.presence === "downloading";
          if (!ready && !admitted) throw new Error("The device catalog is still checking this copy.");
          if (retry) await client.cancelQueries({ queryKey: syncKey, exact: true });
          await client.cancelQueries({ queryKey, exact: true });
          signal.throwIfAborted();
          if (!isCurrent(id, scope)) return;
          // A confirmed retry consumes its earlier failure observations.
          if (retry) clearRetriedFailure(project);
          client.setQueryData(queryKey, (previous: typeof catalog | undefined) => {
            if (!previous) return catalog;
            return {
              ...previous,
              projects: previous.projects.map((entry) =>
                entry.id === id && !(entry.presence === "downloaded" && project?.presence === "downloading")
                  ? project!
                  : entry,
              ),
            };
          });
        },
        async check(signal) {
          if (!isCurrent(id, scope)) return { status: "unknown" };
          const { project } = await observe(signal);
          if (!(await waitForCurrentDevice(signal))) return { status: "unknown" };
          if (project?.presence === "downloaded")
            return { status: "confirmed", result: { projectId: id, presence: project.presence } };
          if (project?.presence !== "downloading") return { status: "unknown" };
          if (retry && !(await progressedRetry(project, action, () => api.projectSyncStatus(id, { signal, expected }))))
            return { status: "unknown" };
          if (!(await waitForCurrentDevice(signal))) return { status: "unknown" };
          return { status: "confirmed", result: { projectId: id, presence: project.presence } };
        },
      });
      // The host may finish the download even if its response never reaches us.
      onAdmitted();
      return operation.result;
    },
  };
});
