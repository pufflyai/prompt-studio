import type { ProjectCopyAccount, ProjectCopyDevice } from "@pstdio/sdk/client";
import { classifyApiWrite, getWorkbenchOperations, operationSubject } from "@pstdio/workbench";
import { getRuntimeApiClient } from "@/lib/api";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { createRuntimeState } from "@/lib/sync/runtime-state";
import { reportWorkbenchError } from "@/lib/workbench-error-report";

import { cloudCatalogKeyFor } from "./project-catalog";
import { cloudCopySourceCommand, requireProjectCopyScope } from "./project-copy-scope";

interface RecoveredProjectOpening {
  id: string;
  read(): { name: string; account: ProjectCopyAccount; device: ProjectCopyDevice } | undefined;
  close(): void;
  select(name: string): Promise<unknown>;
}

export const cloudProjectCopySubject = (id: string) => operationSubject("cloud-project-copy", id);

export const getCloudCopyDownloads = createRuntimeState((owner) => {
  const operations = getWorkbenchOperations(getDashboardScopedQueries(owner));
  const api = getRuntimeApiClient(owner).account;
  const client = getDashboardQueryClient(owner);
  const domain = "project.download-device-copy";
  const openings = new Map<string, { views: number; selected: boolean; pending?: Promise<void> }>();
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
        if (!ready) return;
        try {
          requireProjectCopyScope(owner, id, ready.account, ready.device, "The active Cloud account changed.");
          return ready;
        } catch {
          return undefined;
        }
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
    discard(id: string, attempt: symbol) {
      if (state(id).failure?.id === attempt) operations.discard(attempt);
    },
    async start(id: string, name: string, expected: ProjectCopyAccount, expectedDevice: ProjectCopyDevice) {
      const scope = requireProjectCopyScope(
        owner,
        id,
        expected,
        expectedDevice,
        "The active Cloud account changed. Choose the project again.",
      );
      const subject = cloudProjectCopySubject(id);
      if (state(id).failure || operations.getSnapshot().pending.some((entry) => entry.subjects.includes(subject)))
        throw new Error("This project already has a pending Cloud change.");
      const { login } = scope;
      const queryKey = cloudCatalogKeyFor(login.managerOrigin, login.accountId, login.deviceId, expected.accountId);
      const observe = async (signal: AbortSignal) => {
        scope.assertCurrent();
        const catalog = await api.projectsCatalog({ signal, accountId: scope.accountId, expectedDevice });
        signal.throwIfAborted();
        scope.assertCurrent();
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
        sourceCommand: cloudCopySourceCommand(scope.accountId),
        recoverySource: "cloud-project-picker",
        title: `Download ${name}`,
        draft: { projectId: id, name },
        releaseOnDiscard: true,
        classify: classifyApiWrite,
        write(signal) {
          scope.assertCurrent();
          return api.downloadCloudProject(id, { signal, expected, expectedDevice });
        },
        async reconcile(receipt, signal) {
          const { catalog, project } = await observe(signal);
          const ready = project?.presence === "downloaded";
          const admitted = receipt.presence === "downloading" && project?.presence === "downloading";
          if (!ready && !admitted) throw new Error("The device catalog is still checking this copy.");
          await client.cancelQueries({ queryKey, exact: true });
          signal.throwIfAborted();
          scope.assertCurrent();
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
