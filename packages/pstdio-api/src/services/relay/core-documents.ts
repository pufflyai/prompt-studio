import { coreOwnerId, projectInfoDocumentId } from "pstdio-sync";
import {
  createDocumentRelay,
  createDocumentRelayConnection,
  createDocumentSync,
  fetchSyncSpaces,
} from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";
import type { RelayDeps } from "./deps";
import { createNativeDocumentLive } from "./native-document-live";
import { reconcileProjectInfo } from "./project-info-owner";
import { createSyncQuarantine } from "./quarantine";
import { createResourceNumberSync } from "./resource-number-sync";
import type { RelayWorkbench } from "./runtime";

/**
 * Core documents sync even when no extension is enabled: resource numbers, and the project info
 * a new device reads before the project exists there.
 */
export const startCoreDocumentSync = (input: {
  config: RelayWorkbench;
  deps: RelayDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  statusChanged?: () => void;
}) => {
  const { config, deps } = input;
  const owner = { workbenchId: config.workbenchId, extensionId: coreOwnerId };
  // Project info first: a new device needs the project's name and git remote before its data.
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
  let syncs: ReturnType<typeof createDocumentSync>[] = [];
  let numbers: Awaited<ReturnType<typeof createResourceNumberSync>> | undefined;
  const checkedFolders = new Set<string>();
  let attempt: AbortSignal | undefined;
  let generation: number | undefined;
  // Each reconnect replaces the document syncs. The first download stays done.
  let firstDownloaded = false;
  const close = () => {
    for (const sync of syncs) sync.close();
    syncs = [];
    numbers = undefined;
  };
  const live = createNativeDocumentLive({
    projectId: config.workbenchId,
    deviceId: config.environmentId,
    live: deps.nativeDocuments.live,
    send: (message) => connection.send(message),
  });
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
      live.setSpace(space);
      const relay = (documentId: string) =>
        createDocumentRelay({
          origin: config.relayOrigin,
          space,
          documentId,
          signal: attemptSignal,
          token: async () => (await access()).token,
        });
      const quarantine = (documentId: string) =>
        createSyncQuarantine({ accountId: config.accountId, projectId: config.workbenchId, documentId });
      if (!syncs.length || attempt !== attemptSignal || generation !== space.generation) {
        close();
        const documentId = await space.documentId(JSON.stringify([coreOwnerId, projectInfoDocumentId]));
        syncs = [
          createDocumentSync({
            owner,
            space,
            documentId,
            store: deps.projectInfoService.documentStore,
            relay: relay(documentId),
            quarantine: quarantine(documentId),
          }),
        ];
        attempt = attemptSignal;
        generation = space.generation;
      }
      for (const sync of syncs) await sync.synchronize();
      numbers ??= await createResourceNumberSync({
        owner,
        space,
        service: deps.extensionResourceSequencesService,
        relay,
        quarantine,
      });
      await numbers!.synchronize();
      if (!(await Promise.all([...syncs, numbers!].map((sync) => sync.status()))).every((status) => status.downloaded))
        return;
      firstDownloaded = true;
      await reconcileProjectInfo(deps, config.workbenchId, checkedFolders);
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.core-documents.reconnecting", workbenchId: config.workbenchId },
        "Core document sync will retry",
      ),
    onLive: (message) => {
      void live.receive(message).catch(() => {});
    },
    onStatusChange: () => {
      if (!connection.status().connected) live.clearSpace();
      input.statusChanged?.();
    },
  });
  const changed = (changed: { workbenchId: string }) => {
    if (changed.workbenchId !== owner.workbenchId) return;
    connection.wake();
    input.statusChanged?.();
  };
  const stops = [
    deps.extensionResourceSequencesService.watchChanges(changed),
    deps.projectInfoService.watchChanges(changed),
  ];
  return {
    done: connection.done.finally(async () => {
      for (const stop of stops) stop();
      close();
      await live.close();
    }),
    status: async () => {
      const statuses = await Promise.all([...syncs, ...(numbers ? [numbers] : [])].map((sync) => sync.status()));
      return {
        firstDownloaded,
        downloaded: !!numbers && statuses.length > 0 && statuses.every((status) => status.downloaded),
        pending: statuses.some((status) => status.pending),
        needsAttention: statuses.some((status) => status.needsAttention),
        ...connection.status(),
      };
    },
    close: () => controller.abort(),
  };
};
