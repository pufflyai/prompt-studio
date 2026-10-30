import { coreOwnerId, projectInfoDocumentId } from "pstdio-sync/records";
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
  const documentIds = new Set<string>();
  let summary = { downloaded: false, pending: false, needsAttention: false };
  const close = () => {
    for (const sync of syncs) sync.close();
    syncs = [];
    numbers = undefined;
    documentIds.clear();
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
    acceptsChange: (change) => change.spaceOwner === null && documentIds.has(change.documentId),
    synchronize: async (attemptSignal) => {
      const { project: space } = await fetchSyncSpaces({
        ...config,
        credential: config.renewalGrant,
        signal: attemptSignal,
      });
      live.setSpace(space);
      const relay = (documentId: string) => {
        documentIds.add(documentId);
        return createDocumentRelay({
          origin: config.relayOrigin,
          space,
          documentId,
          signal: attemptSignal,
          token: async () => (await access()).token,
        });
      };
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
      const statuses = await Promise.all([...syncs, numbers!].map((sync) => sync.status()));
      summary = {
        downloaded: statuses.every((status) => status.downloaded),
        pending: statuses.some((status) => status.pending),
        needsAttention: statuses.some((status) => status.needsAttention),
      };
      if (!summary.downloaded) return;
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
    onReady: () => live.republish(),
    onDisconnect: (reason) => {
      if (reason === "renewal") live.renewAccess();
      else live.clearSpace();
    },
    onStatusChange: input.statusChanged,
  });
  const changed = (changed: { workbenchId: string }) => {
    if (changed.workbenchId !== owner.workbenchId) return;
    summary = { ...summary, pending: true };
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
    status: async () => ({ firstDownloaded, ...summary, ...connection.status() }),
    close: () => controller.abort(),
  };
};
