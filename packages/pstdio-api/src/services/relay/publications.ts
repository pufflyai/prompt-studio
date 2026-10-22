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
  let activationFailed = false;
  const connection = createDocumentRelayConnection({
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access,
    signal,
    synchronize: async (attemptSignal) => {
      await documents.synchronize(attemptSignal);
      const catalog = await openPublishedCatalog(deps, config.workbenchId, attemptSignal);
      try {
        const entries = (await catalog.list())
          .filter((record) => !record.deleted && !record.recordId.startsWith("package:"))
          .map((record) => {
            const publication = publicationSchema.parse(record.value);
            if (publication.extensionId !== record.recordId || !record.asset) throw new Error("Invalid extension set");
            return { publication, asset: record.asset };
          });
        await activatePublishedSet(deps, config.workbenchId, entries, attemptSignal, false, async () => {
          const current = (await catalog.list()).map((record) => ({ publication: record.value, asset: record.asset }));
          if (canonicalJson(current) !== canonicalJson(entries))
            throw new Error("Extension set changed during activation; retry");
        });
        activationFailed = false;
      } catch (error) {
        activationFailed = true;
        throw error;
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
      return { ...status, ...connection.status(), needsAttention: status.needsAttention || activationFailed };
    },
    close: () => controller.abort(),
  };
};
