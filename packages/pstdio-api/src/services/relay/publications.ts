import type { ProjectRelayConnection } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { activatePublishedSet } from "../../features/extensions/publication/activate";
import { openPublishedCatalog, publishedEntries, publishedOwner } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { createExtensionDocumentSync } from "./documents";
import type { RelayWorkbench } from "./runtime";

const firstRetryDelay = 30_000;
const maxRetryDelay = 60 * 60_000;

/** The extension set syncs before any extension is installed on a new device. */
export const startPublishedExtensions = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
  relay: ProjectRelayConnection;
  statusChanged?: () => void;
}) => {
  const { config, deps } = input;
  const owner = publishedOwner(config.workbenchId);
  const controller = new AbortController();
  const signal = AbortSignal.any([input.signal, controller.signal]);
  const access = async () => {
    signal.throwIfAborted();
    const cancelled = Promise.withResolvers<never>();
    const abort = () => cancelled.reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      return await Promise.race([input.access(), cancelled.promise]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  };
  const documents = createExtensionDocumentSync({
    config,
    owner,
    deps,
    access,
    statusChanged: input.statusChanged,
    claim: (id) => connection.claim(id),
  });
  // A set that failed to activate is tried again after a growing delay, or at once when it changes.
  // Retrying on every reconnect would repeat package checks, installs and webview builds each time.
  let failed: { key: string; delay: number; waiting: boolean } | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connection = input.relay.attach({
    signal,
    synchronize: async (attemptSignal) => {
      await documents.synchronize(attemptSignal);
      const catalog = await openPublishedCatalog(deps, config.workbenchId, attemptSignal);
      const selected = await catalog.list();
      const key = canonicalJson(selected.map(({ recordId, value, asset }) => ({ recordId, value, asset })));
      if (failed?.key === key && failed.waiting) return;
      try {
        const entries = publishedEntries(selected);
        await activatePublishedSet(deps, config.workbenchId, entries, attemptSignal, false, async () => {
          const current = (await catalog.list()).map((record) => ({ publication: record.value, asset: record.asset }));
          if (canonicalJson(current) !== canonicalJson(entries))
            throw new Error("Extension set changed during activation; retry");
        });
        failed = undefined;
      } catch (error) {
        if (attemptSignal.aborted) throw error;
        const delay = failed?.key === key ? Math.min(failed.delay * 2, maxRetryDelay) : firstRetryDelay;
        const current = { key, delay, waiting: true };
        failed = current;
        clearTimeout(retry);
        retry = setTimeout(() => {
          current.waiting = false;
          connection.wake();
        }, delay);
        apiLogger.warn(
          { event: "relay.publication.activation_failed", workbenchId: config.workbenchId, err: error },
          "The synced extension set could not be activated; the current set stays active",
        );
      } finally {
        input.statusChanged?.();
      }
    },
    onStatusChange: input.statusChanged,
    onError: () =>
      apiLogger.warn(
        { event: "relay.publication.failed", workbenchId: config.workbenchId },
        "Extension set sync will retry",
      ),
  });
  return {
    owner,
    retry() {
      if (failed) failed.waiting = false;
      clearTimeout(retry);
      connection.retry();
    },
    wake: connection.wake,
    done: connection.done.finally(() => {
      clearTimeout(retry);
      documents.close();
    }),
    status: async () => {
      const status = await documents.status();
      return { ...status, ...connection.status(), needsAttention: status.needsAttention || failed !== undefined };
    },
    close: () => controller.abort(),
  };
};
