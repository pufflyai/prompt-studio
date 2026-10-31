import { createReadBoundary } from "pstdio-extensions";
import { createDocumentRelayConnection } from "pstdio-sync/relay";
import { watchArtifactMount } from "../../features/extensions/artifact-mount-watch/mount-watcher";
import { resolveWorkspaceFilesPath } from "../../features/extensions/command-environment/workspace-files";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { createPublicationStorageAccess } from "../../features/extensions/publication/storage-access";
import { apiLogger } from "../../lib/logger";
import { createSharedArtifactMount } from "../shared-files/artifact-mount";
import { createExtensionDocumentSync } from "./documents";
import type { RelayWorkbench } from "./runtime";

export const startRelayExtension = async (input: {
  config: RelayWorkbench;
  source: Awaited<ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>>[number];
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  statusChanged: () => void;
  contextKey: string;
  snapshot: Awaited<ReturnType<ExtensionsRouteDeps["extensionRuntimeCatalog"]["get"]>>;
  access: () => Promise<{ token: string; expiresAt: string }>;
}) => {
  const { config, deps } = input;
  const extensionId = input.source.installedSource.extension_id;
  const owner = { workbenchId: config.workbenchId, extensionId };
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, input.signal]);
  const access = () => createReadBoundary(signal)(input.access);
  const documents = createExtensionDocumentSync({ config, owner, deps, access });
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
  const watches: ReturnType<typeof watchArtifactMount>[] = [];
  const refreshFiles = async () => {
    const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
      () => null,
    );
    if (writableRoot === repoRoot) await Promise.all(mounts.map((mount) => mount.refresh()));
  };
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
      origin: config.relayOrigin,
      projectId: config.workbenchId,
      signal,
      access,
      synchronize: async (attemptSignal) => {
        await refreshFiles();
        await documents.synchronize(attemptSignal);
        await refreshFiles();
      },
      onError: () =>
        apiLogger.warn(
          { event: "relay.reconnecting", workbenchId: owner.workbenchId, extensionId },
          "Relay connection will retry",
        ),
      onStatusChange: input.statusChanged,
    });
    const active = connection;
    return {
      owner,
      contextKey: input.contextKey,
      wake: connection.wake,
      retry: connection.retry,
      done: connection.done.finally(documents.close),
      status: async () => ({ ...(await documents.status()), ...active.status() }),
      close: () => {
        for (const watch of watches) watch.close();
        controller.abort();
      },
    };
  } catch (error) {
    for (const watch of watches) watch.close();
    controller.abort();
    documents.close();
    throw error;
  }
};
