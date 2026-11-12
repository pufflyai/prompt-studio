import { createReadBoundary } from "pstdio-extensions";
import type { LiveConnection } from "pstdio-sync/relay";
import { createDocumentRelayConnection } from "pstdio-sync/relay";
import { watchArtifactMount } from "../../features/extensions/artifact-mount-watch/mount-watcher";
import { resolveWorkspaceFilesPath } from "../../features/extensions/command-environment/workspace-files";
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
            onWrite: (path) => deps.artifactMountWrites.record(path),
          }),
        )
    : [];
  let connection: ReturnType<typeof createDocumentRelayConnection> | undefined;
  const wakeDocument = (name: string) => {
    if (!documents.hasDocument(name)) connection?.wake();
    connection?.wakeDocument(name);
  };
  const watches: ReturnType<typeof watchArtifactMount>[] = [];
  const refreshFiles = async () => {
    const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
      () => null,
    );
    if (writableRoot === repoRoot) await Promise.all(mounts.map((mount) => mount.refresh()));
  };
  // Physical copies follow canonical commits without blocking durable document transport.
  const projections = createNativeProjectionQueue({
    reconcile: async ({ documentKey }) => {
      const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
        () => null,
      );
      if (writableRoot === repoRoot) await Promise.all(mounts.map((mount) => mount.refreshText(documentKey)));
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
    const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
      () => null,
    );
    for (const { root } of writableRoot === repoRoot ? mounts : [])
      watches.push(
        watchArtifactMount({
          root,
          ledger: deps.artifactMountWrites,
          onChange: () => connection?.wake(),
          onError: () => connection?.wake(),
          onFolderLimit: () => connection?.wake(),
        }),
      );
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
        await documents.prepare(attemptSignal);
        await traceRelayOwnerPhase(owner, "files-before", refreshFiles);
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
        for (const watch of watches) watch.close();
        controller.abort();
      },
    };
  } catch (error) {
    stopProjection();
    for (const watch of watches) watch.close();
    controller.abort();
    await projections.drain();
    await documents.close();
    throw error;
  }
};
