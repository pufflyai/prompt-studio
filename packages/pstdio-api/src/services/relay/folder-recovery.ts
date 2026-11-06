import { join } from "node:path";
import type { SyncSpace } from "pstdio-sync/encryption";
import {
  createDocumentRelay,
  createDocumentRelayConnection,
  createDocumentSync,
  fetchSyncSpaces,
  type LiveConnection,
} from "pstdio-sync/relay";
import { apiLogger } from "../../lib/logger";
import { createRecoveryCatalog } from "../project-recovery/catalog";
import { createRecoveryChunkStore } from "../project-recovery/chunks";
import { createLocalRecoverySource } from "../project-recovery/local-source";
import type { RecoveryChunkStore } from "../project-recovery/manifest";
import type { RelayDeps } from "./deps";
import { createSyncQuarantine } from "./quarantine";
import type { RelayWorkbench } from "./runtime";

const catalogName = JSON.stringify(["pstdio.folder-recovery", "catalog-v1"]);

/**
 * Core owner of this device's project-folder capture and of every completed source
 * capture in the account's private catalog. Capture runs locally under its scheduler;
 * the relay pass publishes acknowledged candidates and downloads other sources.
 */
export const startFolderRecovery = (input: {
  config: RelayWorkbench;
  deps: RelayDeps;
  access: () => Promise<{ token: string; expiresAt: string }>;
  live?: LiveConnection;
  signal: AbortSignal;
  statusChanged?: () => void;
  schedule?: { quietMs?: number; gapMs?: number };
}) => {
  const { config, deps } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const catalog = createRecoveryCatalog({
    projectId: config.workbenchId,
    accountId: config.accountId,
    managerOrigin: config.managerOrigin,
    deviceId: config.environmentId,
    documents: deps.extensionStorageService.documents,
  });
  let space: SyncSpace | undefined;
  let chunks: RecoveryChunkStore | undefined;
  let sync: { attempt: AbortSignal; documentSync: ReturnType<typeof createDocumentSync> } | undefined;
  let downloaded = false;
  let catalogId: string | undefined;
  const local = createLocalRecoverySource({
    workbenchId: config.workbenchId,
    accountId: config.accountId,
    deviceId: config.environmentId,
    root: deps.projectRecovery.root,
    workspaces: deps.workspaceService,
    catalog,
    chunks: () => chunks,
    signal,
    schedule: input.schedule,
    captured: () => connection.wake(),
    failed: (error) =>
      apiLogger.warn(
        {
          event: "relay.folder-recovery.capture-failed",
          workbenchId: config.workbenchId,
          code: (error as { code?: string }).code,
        },
        "Folder capture is incomplete and will retry",
      ),
    statusChanged: input.statusChanged,
  });

  const connection = createDocumentRelayConnection({
    live: input.live,
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access: input.access,
    signal,
    acceptsChange: (change) => change.spaceOwner === config.accountId && change.documentId === catalogId,
    // A reconnect may follow missed watch notifications on this device.
    onReady: () => local.request("reconnect"),
    onStatusChange: input.statusChanged,
    onError: () =>
      apiLogger.warn(
        { event: "relay.folder-recovery.reconnecting", workbenchId: config.workbenchId },
        "Folder recovery sync will retry",
      ),
    synchronize: async (attempt, subscribe) => {
      const { personal } = await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal: attempt });
      if (!chunks || space?.generation !== personal.generation) {
        space = personal;
        chunks = await createRecoveryChunkStore({ root: join(deps.projectRecovery.root, "chunks"), space: personal });
        sync?.documentSync.close();
        sync = undefined;
        local.request("startup");
      }
      const store = chunks;
      const documentId = await personal.documentId(catalogName);
      catalogId = documentId;
      const relay = createDocumentRelay({
        subscribe,
        origin: config.relayOrigin,
        space: personal,
        documentId,
        signal: attempt,
        token: async () => (await input.access()).token,
      });
      const transport = await relay.manifestBlobs();
      if (sync?.attempt !== attempt) {
        sync?.documentSync.close();
        sync = {
          attempt,
          documentSync: createDocumentSync({
            owner: catalog.owner,
            store: catalog.store,
            space: personal,
            documentId,
            relay,
            quarantine: createSyncQuarantine({
              accountId: config.accountId,
              projectId: config.workbenchId,
              documentId,
            }),
            references: catalog.references({ chunks: store, transport, signal: attempt }),
          }),
        };
      }
      await local.publish(store, transport, attempt);
      await sync.documentSync.synchronize();
      downloaded = (await sync.documentSync.status()).downloaded;
      input.statusChanged?.();
      await local.prune(store);
    },
  });
  const stopCatalog = deps.extensionStorageService.watch((owner, origin) => {
    if (owner.workbenchId !== config.workbenchId || owner.extensionId !== catalog.owner.extensionId) return;
    if (origin !== "relay") connection.wake();
  });
  return {
    wake: connection.wake,
    retry: connection.retry,
    /** A person's "Back up now": a full scan, then publication when the relay is reachable. */
    capture: () => local.request("explicit"),
    status: async () => ({ ...(await local.status()), downloaded, ...connection.status() }),
    done: connection.done.finally(async () => {
      stopCatalog();
      await local.close();
      sync?.documentSync.close();
    }),
    close: () => controller.abort(),
  };
};
