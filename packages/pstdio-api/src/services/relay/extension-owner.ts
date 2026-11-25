import { existsSync } from "node:fs";
import type { AssetOwner } from "pstdio-api-contracts";
import { createReadBoundary } from "pstdio-extensions";
import type { LiveConnection } from "pstdio-sync/relay";
import { createDocumentRelayConnection } from "pstdio-sync/relay";
import { watchArtifactMount } from "../../features/extensions/artifact-mount-watch/mount-watcher";
import {
  resolveWorkspaceFilesPath,
  WorkspaceFileAccessDeniedError,
} from "../../features/extensions/command-environment/workspace-files";
import { WorkspaceTargetUnavailableError } from "../../features/extensions/command-environment/workspace-target";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createPublicationStorageAccess } from "../../features/extensions/publication/storage-access";
import { apiLogger } from "../../lib/logger";
import { createNativeProjectionQueue } from "../native-documents/projection-queue";
import { createSharedArtifactMount } from "../shared-files/artifact-mount";
import type { RelayDeps } from "./deps";
import { createExtensionDocumentSync } from "./documents";
import { traceRelayOwnerPhase } from "./record-stream-progress";
import type { RelayWorkbench } from "./runtime";

type RelaySource = Awaited<ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>>[number];
type RelaySnapshot = Awaited<ReturnType<ExtensionsRouteDeps["extensionRuntimeCatalog"]["get"]>>;

// View bundles change the catalog generation without changing a document owner.
// Keep its transport until its source, file mounts or workspace actually changes.
export const extensionOwnerContextKey = (input: {
  source: RelaySource;
  snapshot: RelaySnapshot;
  workspace: Awaited<ReturnType<RelayDeps["workspaceService"]["getDefault"]>>;
}) => {
  const {
    source: { installedSource, instance },
    snapshot,
    workspace,
  } = input;
  return JSON.stringify([
    instance.id,
    installedSource.id,
    installedSource.source_path,
    installedSource.source_hash,
    installedSource.source_ref,
    installedSource.version,
    snapshot.runtime.artifactMounts
      .filter((mount) => mount.extensionId === installedSource.extension_id)
      .map(({ name, relativePath }) => [name, relativePath]),
    workspace?.id,
    workspace?.root_path,
    workspace?.execution_kind,
    workspace?.provider_state,
    workspace?.initializing,
    workspace?.setup_error,
    workspace?.deleted_at,
    workspace?.provider_capabilities_json,
  ]);
};

const startRelayArtifactWatches = (input: {
  deps: RelayDeps;
  owner: AssetOwner;
  repoRoot: string;
  roots: ReadonlySet<string>;
  signal: AbortSignal;
  wake: () => void;
}) => {
  const { deps, owner, signal } = input;
  const watches = new Map<string, ReturnType<typeof watchArtifactMount>>();
  let retry: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  const scheduleRetry = () => {
    retry = setTimeout(() => void open(), Math.min(1_000 * 2 ** failures++, 30_000));
    retry.unref?.();
  };

  const open = async () => {
    if (signal.aborted) return;
    const writable = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch((error) => {
      if (signal.aborted) return null;
      if (error instanceof WorkspaceFileAccessDeniedError) {
        apiLogger.debug(
          { event: "relay.artifact_watch.write_denied", ...owner },
          "Relay artifact watch needs file writes",
        );
        return null;
      }
      if (error instanceof WorkspaceTargetUnavailableError) {
        apiLogger.debug(
          { event: "relay.artifact_watch.workspace_pending", ...owner },
          "Relay artifact watch is waiting for a ready workspace",
        );
      } else {
        apiLogger.warn(
          { err: error, event: "relay.artifact_watch.lookup_failed", ...owner },
          "Relay artifact watch workspace lookup failed",
        );
      }
      scheduleRetry();
      return null;
    });
    if (signal.aborted || writable !== input.repoRoot) return;
    if (!existsSync(input.repoRoot)) {
      scheduleRetry();
      return;
    }

    for (const root of input.roots) {
      if (watches.has(root)) continue;
      try {
        const watch = watchArtifactMount({
          root,
          workspaceRoot: input.repoRoot,
          ledger: deps.artifactMountWrites,
          onChange: input.wake,
          onError: input.wake,
          onRootRetryError: (error) =>
            apiLogger.warn(
              { err: error, event: "relay.artifact_watch.reopen_failed", ...owner, root },
              "Relay artifact watch root will retry",
            ),
          onFolderLimit: input.wake,
        });
        watches.set(root, watch);
        // A recovered watch may have missed edits while its mount was unwatched.
        if (failures > 0) input.wake();
      } catch (error) {
        apiLogger.warn(
          { err: error, event: "relay.artifact_watch.start_failed", ...owner, root },
          "Relay artifact watch failed to start",
        );
      }
    }
    if (watches.size < input.roots.size) scheduleRetry();
  };

  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(retry);
      for (const watch of watches.values()) watch.close();
      watches.clear();
    },
    { once: true },
  );
  void open();
};

export const startRelayExtension = async (input: {
  live?: LiveConnection;
  config: RelayWorkbench;
  source: RelaySource;
  deps: RelayDeps;
  signal: AbortSignal;
  statusChanged: () => void;
  contextKey: string;
  snapshot: RelaySnapshot;
  access: () => Promise<{ token: string; expiresAt: string }>;
}) => {
  const { config, deps } = input;
  const extensionId = input.source.installedSource.extension_id;
  const owner = { workbenchId: config.workbenchId, extensionId };
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const access = () => createReadBoundary(signal)(input.access);
  const documents = createExtensionDocumentSync({
    config,
    owner,
    deps,
    access,
    subscribe: (space, id) => connection?.subscribe(space, id),
    discoveryNeeded: () => connection?.wake(),
    statusChanged: input.statusChanged,
    beforeDownload: () => traceRelayOwnerPhase(owner, "files-before", refreshFiles),
  });
  const snapshot = input.snapshot;
  const repoRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "read").catch(() => null);
  const mounts = repoRoot
    ? snapshot.runtime.artifactMounts
        .filter((mount) => mount.extensionId === extensionId)
        .map((mount) =>
          createSharedArtifactMount(deps, {
            assertWritable: createPublicationStorageAccess(deps, {
              projectId: owner.workbenchId,
              extensionId,
              extensionInstanceId: input.source.instance.id,
              source: input.source.installedSource,
            }).write,
            projectId: owner.workbenchId,
            extensionId,
            repoRoot,
            name: mount.name,
            mountPath: mount.relativePath,
            mountPaths: snapshot.runtime.artifactMounts
              .filter((candidate) => candidate.extensionId === extensionId)
              .map((candidate) => candidate.relativePath),
            signal,
            resolveWriteRoot: () => resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write"),
            onWrite: (...write) => deps.artifactMountWrites.record(...write),
          }),
        )
    : [];
  let connection: ReturnType<typeof createDocumentRelayConnection> | undefined;
  const wakeDocument = (name: string) => {
    if (!documents.hasDocument(name)) connection?.wake();
    connection?.wakeDocument(name);
  };
  const refreshFiles = async () => {
    const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
      () => null,
    );
    if (writableRoot && writableRoot === repoRoot && existsSync(writableRoot)) {
      await Promise.all(mounts.map((mount) => mount.refresh()));
    }
  };
  // Physical copies follow canonical commits without blocking durable document transport.
  const projections = createNativeProjectionQueue({
    reconcile: async ({ documentKey }) => {
      const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
        () => null,
      );
      if (writableRoot && writableRoot === repoRoot && existsSync(writableRoot)) {
        await Promise.all(mounts.map((mount) => mount.refreshText(documentKey)));
      }
    },
    failed: (_address, error) =>
      apiLogger.warn({ error, workbenchId: owner.workbenchId, extensionId }, "Artifact text projection failed"),
  });
  const stopProjection = deps.extensionStorageService.watch(({ documentId, ...changed }) => {
    if (
      changed.workbenchId !== owner.workbenchId ||
      changed.extensionId !== extensionId ||
      !documentId?.startsWith('["native-markdown",')
    )
      return;
    const [, documentKey] = JSON.parse(documentId) as [string, string];
    void projections.request({ owner, documentKey }).catch(() => {});
  });
  try {
    connection = createDocumentRelayConnection({
      live: input.live,
      origin: config.relayOrigin,
      projectId: config.workbenchId,
      signal,
      access,
      acceptsChange: documents.acceptsChange,
      synchronizeChanged: documents.synchronizeChanged,
      synchronizeDocument: documents.synchronizeDocument,
      onReady: () => {
        for (const name of deps.nativeDocuments.sources.current(owner)) wakeDocument(name);
      },
      synchronize: async (attemptSignal) => {
        await traceRelayOwnerPhase(owner, "documents", () => documents.synchronize(attemptSignal));
        await traceRelayOwnerPhase(owner, "files-after", refreshFiles);
      },
      onError: (error) =>
        apiLogger.warn(
          { err: error, event: "relay.reconnecting", workbenchId: owner.workbenchId, extensionId },
          "Relay connection will retry",
        ),
      onStatusChange: input.statusChanged,
    });
    const active = connection;
    if (repoRoot && mounts.length > 0) {
      startRelayArtifactWatches({
        deps,
        owner,
        repoRoot,
        roots: new Set(mounts.map(({ root }) => root)),
        signal,
        wake: active.wake,
      });
    }
    return {
      owner,
      contextKey: input.contextKey,
      wake: connection.wake,
      wakeDocument,
      retry: connection.retry,
      restart: connection.restart,
      done: connection.done.finally(async () => {
        stopProjection();
        await projections.drain();
        await documents.close();
      }),
      status: async () => ({ ...(await documents.status()), ...active.status() }),
      close: () => {
        stopProjection();
        controller.abort();
      },
    };
  } catch (error) {
    stopProjection();
    controller.abort();
    await projections.drain();
    await documents.close();
    throw error;
  }
};
