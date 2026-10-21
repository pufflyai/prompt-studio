import { resourceNumbersDocumentId, resourceNumbersOwnerId } from "pstdio-sync";
import {
  createDocumentRelay,
  createDocumentRelayConnection,
  createDocumentSync,
  fetchSyncSpaces,
} from "pstdio-sync/relay";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

/** Core identities sync even when their owning extension is disabled or removed. */
export const startResourceNumberSync = (input: {
  config: RelayWorkbench;
  deps: ExtensionsRouteDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  statusChanged?: () => void;
}) => {
  const { config, deps } = input;
  const owner = { workbenchId: config.workbenchId, extensionId: resourceNumbersOwnerId };
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
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
  let sync: ReturnType<typeof createDocumentSync> | undefined;
  let attempt: AbortSignal | undefined;
  let generation: number | undefined;
  const connection = createDocumentRelayConnection({
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access,
    signal,
    synchronize: async (attemptSignal) => {
      const { project: space } = await fetchSyncSpaces({
        ...config,
        credential: config.renewalGrant,
        signal: attemptSignal,
      });
      if (!sync || attempt !== attemptSignal || generation !== space.generation) {
        sync?.close();
        const documentId = await space.documentId(JSON.stringify([resourceNumbersOwnerId, resourceNumbersDocumentId]));
        sync = createDocumentSync({
          owner,
          space,
          documentId,
          store: deps.extensionResourceSequencesService.documentStore,
          relay: createDocumentRelay({
            origin: config.relayOrigin,
            space,
            documentId,
            signal: attemptSignal,
            token: async () => (await access()).token,
          }),
          quarantine: createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId }),
        });
        attempt = attemptSignal;
        generation = space.generation;
      }
      await sync.synchronize();
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.resource-numbers.reconnecting", workbenchId: config.workbenchId },
        "Resource number sync will retry",
      ),
    onStatusChange: input.statusChanged,
  });
  const stop = deps.extensionResourceSequencesService.watchChanges((changed) => {
    if (changed.workbenchId !== owner.workbenchId) return;
    connection.wake();
    input.statusChanged?.();
  });
  return {
    done: connection.done.finally(() => {
      stop();
      sync?.close();
    }),
    status: async () => ({
      ...((await sync?.status()) ?? { downloaded: false, pending: false, needsAttention: false }),
      ...connection.status(),
    }),
    close: () => controller.abort(),
  };
};
