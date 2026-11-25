import type {
  CloudProjectCatalog,
  CloudProjectCatalogEntry,
  ProjectCopyAccount,
  ProjectCopyDevice,
  ProjectSyncStatus,
} from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardAccountStatusQuery, getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeFeed, createRuntimeState } from "@/lib/sync/runtime-state";
import { reportWorkbenchError } from "@/lib/workbench-error-report";

import { cloudCatalogKeyFor, cloudProjectDeletionKey } from "./project-catalog";
import {
  cloudCopyBusy,
  cloudCopySourceCommand,
  cloudCopySyncKey,
  cloudProjectCopySubject,
  deviceProjectCopySubject,
  requireProjectCopyScope,
} from "./project-copy-scope";

interface RecoveredProjectOpening {
  id: string;
  read(): { name: string; account: ProjectCopyAccount; device: ProjectCopyDevice } | undefined;
  close(): void;
  select(name: string): Promise<unknown>;
}

export const cloudCopyDownloadAction = (entry?: CloudProjectCatalogEntry, sync?: ProjectSyncStatus) => {
  if (!entry?.actions.download) return;
  if (entry.presence === "cloud-only") return entry;
  if (entry.presence !== "downloading") return;
  if (entry.downloadError) return entry;
  if (sync?.state === "needs-attention") return sync;
};

type DownloadAction = NonNullable<ReturnType<typeof cloudCopyDownloadAction>>;

const progressedRetry = async (
  project: CloudProjectCatalogEntry,
  action: DownloadAction,
  readSync: () => Promise<ProjectSyncStatus>,
) => {
  if (!project.online) return false;
  if ("presence" in action) return Boolean(action.downloadError && !project.downloadError);
  if (project.downloadError) return false;
  const { state } = await readSync();
  return state === "first-download-incomplete" || state === "waiting-to-sync" || state === "synced";
};

const localCopyRemovals = createRuntimeFeed<string>();

export const getCloudCopyDownloads = createRuntimeState((owner) => {
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).account;
  const client = getDashboardQueryClient(owner);
  const domain = "project.download-device-copy";
  const accountStatus = getDashboardAccountStatusQuery(owner);
  const accountPending = () => accountStatus.getSnapshot().fetching;
  const isCurrent = (id: string, account?: ProjectCopyAccount, device?: ProjectCopyDevice) => {
    if (!account || accountPending()) return false;
    try {
      requireProjectCopyScope(owner, id, account, device, "The active Cloud account changed.");
      return true;
    } catch {
      return false;
    }
  };
  const openings = new Map<string, { views: number; selected: boolean; pending?: Promise<void> }>();
  const state = (id: string, account?: ProjectCopyAccount, device?: ProjectCopyDevice) => {
    if (!account || !device) return {};
    const { pending, recovery } = operations.getSnapshot();
    const subject = deviceProjectCopySubject(id, account, device);
    const matches = (entry: { domain: string; subjects: readonly string[] }) =>
      entry.domain === domain && entry.subjects.includes(subject);
    const active = pending.find(matches);
    const failure = recovery.find((entry) => matches(entry) && !entry.retired && entry.status !== "rejected");
    return { active, failure };
  };

  return {
    state,
    isCurrent,
    subscribeToLocalRemoval: (listener: (scope: string) => void) => localCopyRemovals.subscribe(listener, owner),
    localCopyRemoved: (scope: string) => localCopyRemovals.publish(scope, owner),
    snapshot: operations.getSnapshot,
    subscribe: operations.subscribe,
    check: operations.check,
    observeOpening(scope: string) {
      // Concurrent views of this recovery share navigation until the last view closes.
      const opening = openings.get(scope) ?? { views: 0, selected: false };
      openings.set(scope, opening);
      opening.views++;
      let released = false;
      let waiting = false;
      const readOpening = ({ id, read }: RecoveredProjectOpening) => {
        if (released || owner.isDisposed()) return;
        const ready = read();
        return ready && isCurrent(id, ready.account, ready.device) ? ready : undefined;
      };
      return {
        async open(input: RecoveredProjectOpening) {
          if (waiting) return;
          waiting = true;
          const { id, close, select } = input;
          try {
            while (opening.pending) await opening.pending;
            const ready = readOpening(input);
            if (!ready) return;
            if (opening.selected) {
              close();
              return;
            }
            const settled = Promise.withResolvers<void>();
            opening.pending = settled.promise;
            try {
              close();
              opening.selected = (await select(ready.name)) !== false;
            } finally {
              opening.pending = undefined;
              settled.resolve();
            }
          } catch (error) {
            reportWorkbenchError(error, id);
          } finally {
            waiting = false;
          }
        },
        release() {
          released = true;
          if (--opening.views !== 0) return;
          // Strict Mode replays cleanup and setup before the microtask queue runs.
          queueMicrotask(() => {
            if (opening.views === 0 && openings.get(scope) === opening) openings.delete(scope);
          });
        },
      };
    },
    discard(id: string, account: ProjectCopyAccount, device: ProjectCopyDevice, attempt: symbol) {
      if (isCurrent(id, account, device) && state(id, account, device).failure?.id === attempt)
        operations.discard(attempt);
    },
    async start(
      id: string,
      expected: ProjectCopyAccount,
      expectedDevice: ProjectCopyDevice,
      action: DownloadAction,
      onAdmitted: () => void,
    ) {
      const scope = requireProjectCopyScope(
        owner,
        id,
        expected,
        expectedDevice,
        "The active Cloud account changed. Choose the project again.",
      );
      if (accountPending() || cloudCopyBusy(operations, id, expected, expectedDevice)) return;
      const { login } = scope;
      const queryKey = cloudCatalogKeyFor(login.managerOrigin, login.accountId, login.deviceId, expected.accountId);
      const syncKey = cloudCopySyncKey(scope.key);
      const catalog = client.getQueryData<CloudProjectCatalog>(queryKey);
      if (
        !catalog ||
        catalog.deletions.some((entry) => entry.projectId === id) ||
        client.getQueryData(cloudProjectDeletionKey(id, expected, login))
      )
        return;
      const project = catalog.projects.find((entry) => entry.id === id);
      const sync = client.getQueryData<ProjectSyncStatus>(syncKey);
      if (!project || cloudCopyDownloadAction(project, sync) !== action) return;
      const retry = project.presence === "downloading";
      const clearRetriedFailure = (observed: CloudProjectCatalogEntry) => {
        const cachedSync = client.getQueryCache().find<ProjectSyncStatus>({ queryKey: syncKey, exact: true });
        if (cachedSync?.state.data?.state === "needs-attention") cachedSync.reset();
        if ("presence" in action && action.downloadError && observed.downloadError === action.downloadError) {
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
        await scope.waitForCurrent(signal);
        const catalog = await api.projectsCatalog({ signal, accountId: scope.accountId, expectedDevice });
        await scope.waitForCurrent(signal);
        if (
          catalog.account?.accountId !== expected.accountId ||
          catalog.account.managerOrigin !== expected.managerOrigin
        )
          throw new Error("The active Cloud account changed.");
        return { catalog, project: catalog.projects.find((entry) => entry.id === id) };
      };
      const operation = operations.submit({
        projectId: id,
        domain,
        subjects: [deviceProjectCopySubject(id, expected, expectedDevice)],
        intent: cloudProjectCopySubject(id, expected),
        sourceCommand: cloudCopySourceCommand(scope.accountId),
        recoverySource: "cloud-project-picker",
        title: `Download ${project.name}`,
        draft: { projectId: id, name: project.name },
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        async write(signal) {
          await scope.waitForCurrent(signal);
          return api.downloadCloudProject(id, { signal, expected, expectedDevice });
        },
        async reconcile(receipt, signal) {
          const { catalog, project } = await observe(signal);
          if (
            !project ||
            (project.presence !== "downloaded" &&
              (project.presence !== "downloading" || receipt.presence !== "downloading"))
          )
            throw new Error("The device catalog is still checking this copy.");
          if (retry) await client.cancelQueries({ queryKey: syncKey, exact: true });
          await client.cancelQueries({ queryKey, exact: true });
          await scope.waitForCurrent(signal);
          if (retry) clearRetriedFailure(project);
          client.setQueryData(queryKey, (previous: typeof catalog | undefined) => {
            if (!previous) return catalog;
            return { ...previous, projects: previous.projects.map((entry) => (entry.id === id ? project : entry)) };
          });
        },
        async check(signal) {
          const { project } = await observe(signal);
          if (project?.presence === "downloaded")
            return { status: "confirmed", result: { projectId: id, presence: project.presence } };
          if (project?.presence !== "downloading") return { status: "unknown" };
          const personal = { accountId: login.accountId, managerOrigin: login.managerOrigin };
          if (
            retry &&
            !(await progressedRetry(project, action, () => api.projectSyncStatus(id, { signal, expected: personal })))
          )
            return { status: "unknown" };
          await scope.waitForCurrent(signal);
          return { status: "confirmed", result: { projectId: id, presence: project.presence } };
        },
      });
      onAdmitted();
      return operation.result;
    },
  };
});
