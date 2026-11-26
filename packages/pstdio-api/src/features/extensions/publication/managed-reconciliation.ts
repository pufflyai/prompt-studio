import { canonicalJson, type TeamExtensionPolicy } from "pstdio-sync-contracts";
import { apiLogger } from "../../../lib/logger";
import type { ExtensionsRouteDeps } from "../deps";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publishedEntries } from "./catalog";
import { PublicationChangedError } from "./types";

interface ReconciliationInput {
  projects(): Promise<{ projectId: string; scope: string }[]>;
  policy(projectId: string, signal: AbortSignal): Promise<TeamExtensionPolicy[]>;
  apply(projectId: string, signal: AbortSignal): Promise<unknown>;
  failed(projectId: string | undefined, error: unknown): void;
}

/** Account refresh already owns the polling cadence; only changed policy decisions activate a copy. */
export const createManagedExtensionReconciliation = (input: ReconciliationInput) => {
  const applied = new Map<string, string>();
  const shutdown = new AbortController();
  let running = Promise.resolve();
  let queued: Promise<void> | undefined;
  const updateProject = async ({ projectId, scope }: { projectId: string; scope: string }) => {
    try {
      const policy = await input.policy(projectId, shutdown.signal);
      const key = canonicalJson({ scope, policy });
      if (applied.get(projectId) === key || (!policy.length && !applied.has(projectId))) return;
      shutdown.signal.throwIfAborted();
      await input.apply(projectId, shutdown.signal);
      shutdown.signal.throwIfAborted();
      applied.set(projectId, key);
    } catch (error) {
      if (shutdown.signal.aborted) return;
      applied.delete(projectId);
      input.failed(projectId, error);
    }
  };
  const reconcile = async () => {
    const projects = await input.projects();
    const current = new Set(projects.map(({ projectId }) => projectId));
    for (const id of applied.keys()) if (!current.has(id)) applied.delete(id);
    for (const project of projects) {
      if (shutdown.signal.aborted) return;
      await updateProject(project);
    }
  };
  return {
    changed() {
      if (shutdown.signal.aborted) return running;
      if (queued) return queued;
      const next = running
        .then(async () => {
          queued = undefined;
          if (!shutdown.signal.aborted) await reconcile();
        })
        .catch((error) => {
          if (!shutdown.signal.aborted) input.failed(undefined, error);
        });
      queued = next;
      running = next;
      return next;
    },
    async close() {
      shutdown.abort();
      await running;
      applied.clear();
    },
  };
};

export const startManagedProjectUpdates = (deps: ExtensionsRouteDeps) =>
  createManagedExtensionReconciliation({
    projects: deps.accountService.managedProjectCopies,
    policy: (id, signal) => deps.accountService.readManagedProjectPolicy(id, signal),
    apply: async (projectId, signal) => {
      const catalog = await openPublishedCatalog(deps, projectId, signal);
      const entries = publishedEntries(await catalog.list());
      return activatePublishedSet(deps, projectId, entries, signal, false, async () => {
        if (canonicalJson(publishedEntries(await catalog.list())) !== canonicalJson(entries))
          throw new PublicationChangedError();
      });
    },
    failed: (projectId, error) =>
      apiLogger.warn(
        { event: "account.managed_extensions.update_failed", projectId, error },
        "Required team tools could not be updated; the next account refresh will retry",
      ),
  });
