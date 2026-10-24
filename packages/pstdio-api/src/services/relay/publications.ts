import { createDocumentRelayConnection } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { activatePublishedSet } from "../../features/extensions/publication/activate";
import { openPublishedCatalog, publicationSchema, publishedOwner } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { createExtensionDocumentSync } from "./documents";
import type { RelayWorkbench } from "./runtime";

/** The extension set syncs before any extension is installed on a new device. */
export const startPublishedExtensions = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  access: () => Promise<{ token: string; expiresAt: string }>;
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
  const documents = createExtensionDocumentSync({ config, owner, deps, access });
  // A set that failed to activate waits until it changes. Retrying it on every reconnect would
  // repeat the package checks, dependency installs and webview builds without a different result.
  let failedSet: string | undefined;
  const connection = createDocumentRelayConnection({
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access,
    signal,
    synchronize: async (attemptSignal) => {
      await documents.synchronize(attemptSignal);
      const catalog = await openPublishedCatalog(deps, config.workbenchId, attemptSignal);
      const selected = await catalog.list();
      const key = canonicalJson(selected.map(({ recordId, value, asset }) => ({ recordId, value, asset })));
      if (key === failedSet) return;
      try {
        const entries = selected.map((record) => {
          const publication = publicationSchema.parse(record.value);
          if (publication.extensionId !== record.recordId || !record.asset) throw new Error("Invalid extension set");
          return { publication, asset: record.asset };
        });
        await activatePublishedSet(deps, config.workbenchId, entries, attemptSignal, false, async () => {
          const current = (await catalog.list()).map((record) => ({ publication: record.value, asset: record.asset }));
          if (canonicalJson(current) !== canonicalJson(entries))
            throw new Error("Extension set changed during activation; retry");
        });
        failedSet = undefined;
      } catch (error) {
        if (attemptSignal.aborted) throw error;
        failedSet = key;
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
    wake: connection.wake,
    done: connection.done.finally(documents.close),
    status: async () => {
      const status = await documents.status();
      return { ...status, ...connection.status(), needsAttention: status.needsAttention || failedSet !== undefined };
    },
    close: () => controller.abort(),
  };
};
