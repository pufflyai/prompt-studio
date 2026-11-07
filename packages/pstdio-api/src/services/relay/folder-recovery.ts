import { join } from "node:path";
import type { ProjectFolderRecoveryStatus } from "pstdio-api-contracts";
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
import { createRecoveryOperations, folderRecoveryError, type RecoveryAttach } from "../project-recovery/operations";
import { createRecoveryStagingJournal } from "../project-recovery/restore-staging";
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
  // A failed publication is reported without blocking downloads or local retention.
  let publishFailed = false;
  let publishRetry: ReturnType<typeof setTimeout> | undefined;
  let offline = false;
  // Blob transport of the live relay pass; downloads and restores use it while it lasts.
  let connected:
    | { transport: Awaited<ReturnType<ReturnType<typeof createDocumentRelay>["manifestBlobs"]>>; signal: AbortSignal }
    | undefined;
  // A staging folder left by a crashed restore is removed once this process starts.
  void createRecoveryStagingJournal(deps.projectRecovery.root)
    .clean()
    .catch(() => {});
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

  const operations = createRecoveryOperations({
    workRoot: deps.projectRecovery.root,
    deviceId: config.environmentId,
    catalog,
    chunks: () => chunks,
    transport: () => (connected && !connected.signal.aborted ? connected : undefined),
    enroll: (workspaceId, folder) => local.enroll(workspaceId, folder),
    changed: () => input.statusChanged?.(),
    signal,
  });

  const connection = createDocumentRelayConnection({
    live: input.live,
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access: input.access,
    signal,
    acceptsChange: (change) => change.spaceOwner === config.accountId && change.documentId === catalogId,
    onDisconnect: (reason) => {
      if (reason === "offline") offline = true;
    },
    // Only a live reconnect follows a gap; a retry after a failed pass rescans nothing.
    onReady: () => {
      if (!offline) return;
      offline = false;
      local.request("reconnect");
    },
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
      connected = { transport, signal: attempt };
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
      try {
        await local.publish(store, transport, attempt);
        publishFailed = false;
      } catch {
        attempt.throwIfAborted();
        publishFailed = true;
        clearTimeout(publishRetry);
        publishRetry = setTimeout(() => connection.wake(), 30_000);
        publishRetry.unref?.();
        apiLogger.warn(
          { event: "relay.folder-recovery.publish-failed", workbenchId: config.workbenchId },
          "Folder capture publication will retry",
        );
      }
      await sync.documentSync.synchronize();
      downloaded = (await sync.documentSync.status()).downloaded;
      input.statusChanged?.();
      await local.prune(store);
    },
  });
  // A changed or newly ready default workspace can move the folder: rescan and watch the current one.
  const stopWorkspaces = deps.eventBus.subscribe((event) => {
    if (event.table !== "workspaces") return;
    const workspace = event.data as { project_id?: unknown } | null;
    if (event.op === "delete" || workspace?.project_id === config.workbenchId) local.request("watcher-lost");
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
    sources: operations.sources,
    download: operations.download,
    restore: (input: Parameters<typeof operations.restore>[0], attach: RecoveryAttach) =>
      operations.restore(input, attach),
    cancel: operations.cancel,
    /** Capture, download and restore progress for the project's derived sync status. */
    async folder(): Promise<ProjectFolderRecoveryStatus> {
      const own = await local.status();
      let state: ProjectFolderRecoveryStatus["capture"]["state"] = "idle";
      if (own.needsAttention || publishFailed) state = "needs-attention";
      else if (own.capturing) state = "running";
      else if (own.pending) state = "pending";
      let error = own.error ? folderRecoveryError(own.error) : null;
      if (!error && publishFailed)
        error = { code: "failed", message: "Uploading this folder's copy to Cloud failed and will retry.", path: null };
      return { capture: { state, folder: own.folder, error }, ...operations.status() };
    },
    async status() {
      const own = await local.status();
      return { ...own, needsAttention: own.needsAttention || publishFailed, downloaded, ...connection.status() };
    },
    done: connection.done.finally(async () => {
      stopCatalog();
      stopWorkspaces();
      clearTimeout(publishRetry);
      await local.close();
      sync?.documentSync.close();
    }),
    close: () => controller.abort(),
  };
};
