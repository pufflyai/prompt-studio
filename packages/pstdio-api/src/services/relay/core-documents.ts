import { coreOwnerId, projectInfoDocumentId } from "pstdio-sync/records";
import type { LiveConnection } from "pstdio-sync/relay";
import {
  createDocumentRelay,
  createDocumentRelayConnection,
  createDocumentSync,
  createLiveConnection,
  fetchSyncSpaces,
} from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";
import type { RelayDeps } from "./deps";
import { documentProgress } from "./document-progress";
import { createNativeDocumentChannel } from "./native-document-channel";
import { reconcileProjectInfo } from "./project-info-owner";
import { createSyncQuarantine } from "./quarantine";
import { createResourceNumberSync } from "./resource-number-sync";
import type { RelayWorkbench } from "./runtime";
import { createSourceActivity } from "./source-activity";

/**
 * Core documents sync even when no extension is enabled: resource numbers, and the project info
 * a new device reads before the project exists there.
 */
export const startCoreDocumentSync = (input: {
  live?: LiveConnection;
  config: RelayWorkbench;
  deps: RelayDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
  statusChanged?: () => void;
}) => {
  const { config, deps } = input;
  const activity = createSourceActivity(input.statusChanged);
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
  const close = () => {
    for (const sync of syncs) sync.close();
    syncs = [];
    numbers = undefined;
    documentIds.clear();
  };
  const channel =
    input.live ?? createLiveConnection({ origin: config.relayOrigin, projectId: config.workbenchId, access, signal });
  const live = createNativeDocumentChannel({
    projectId: config.workbenchId,
    deviceId: config.environmentId,
    live: deps.nativeDocuments.live,
    channel,
  });
  const connection = createDocumentRelayConnection({
    live: channel,
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access,
    signal,
    acceptsChange: (change) => change.spaceOwner === null && documentIds.has(change.documentId),
    synchronize: async (attemptSignal, subscribe) => {
      activity.start();
      const { project: space } = await activity.run(
        "loading-keys",
        () =>
          fetchSyncSpaces({
            ...config,
            credential: config.renewalGrant,
            signal: attemptSignal,
          }),
        attemptSignal,
      );
      live.setSpace(space);
      const relay = (documentId: string) => {
        documentIds.add(documentId);
        return createDocumentRelay({
          subscribe,
          origin: config.relayOrigin,
          space,
          documentId,
          signal: attemptSignal,
          token: async () => (await access()).token,
          progress: activity.network,
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
      for (const sync of syncs) {
        await activity.run("project-information", () => sync.synchronize(), attemptSignal);
        input.statusChanged?.();
      }
      numbers ??= await createResourceNumberSync({
        owner,
        space,
        service: deps.extensionResourceSequencesService,
        relay,
        quarantine,
      });
      await activity.run("resource-numbers", () => numbers!.synchronize(), attemptSignal);
      const statuses = await Promise.all([...syncs, numbers!].map((sync) => sync.status()));
      if (!statuses.every((status) => status.downloaded)) return;
      firstDownloaded = true;
      await activity.run(
        "project-folder",
        () => reconcileProjectInfo(deps, config.workbenchId, checkedFolders),
        attemptSignal,
      );
      activity.complete();
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.core-documents.reconnecting", workbenchId: config.workbenchId },
        "Core document sync will retry",
      ),
    onStatusChange: input.statusChanged,
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
    wake: connection.wake,
    retry: connection.retry,
    restart: connection.restart,
    done: connection.done.finally(async () => {
      for (const stop of stops) stop();
      close();
      activity.close();
      await live.close();
      if (!input.live) {
        channel.close();
        await channel.done;
      }
    }),
    status: async () => {
      const statuses = await Promise.all([syncs[0]?.status(), numbers?.status()]);
      return {
        firstDownloaded,
        ...documentProgress(statuses, true),
        ...connection.status(),
        ...activity.status(),
      };
    },
    close: () => controller.abort(),
  };
};
