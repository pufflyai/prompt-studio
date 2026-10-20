import { createReadBoundary, resolveArtifactMountRoot } from "pstdio-extensions";
import { createRelayAdapter, createRelayConnection } from "pstdio-sync/relay";
import { watchArtifactMount } from "../../features/extensions/artifact-mount-watch/mount-watcher";
import { resolveWorkspaceFilesPath } from "../../features/extensions/command-environment/workspace-files";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { hashExtensionSource } from "../../features/extensions/extension-runtime";
import { apiLogger } from "../../lib/logger";
import { createSharedArtifactMount } from "../shared-files/artifact-mount";
import type { RelayWorkbench } from "./runtime";

export const startRelayExtension = async (input: {
  config: RelayWorkbench;
  source: Awaited<ReturnType<ExtensionsRouteDeps["extensionService"]["listEnabledSourcesForProject"]>>[number];
  deps: ExtensionsRouteDeps;
  signal: AbortSignal;
  notify: () => void;
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
  const adapterFor = (signal: AbortSignal) =>
    createRelayAdapter({
      origin: config.relayOrigin,
      scope: { ...owner, accountId: config.accountId },
      token: async () => (await access()).token,
      signal,
    });
  const adapter = adapterFor(signal);
  const revision =
    input.source.installedSource.loaded_revision ??
    input.source.installedSource.source_hash ??
    (await hashExtensionSource(input.source.installedSource.source_path));
  const snapshot = input.snapshot;
  const repoRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "read").catch(() => null);
  const mounts = repoRoot
    ? snapshot.runtime.artifactMounts
        .filter((mount) => mount.extensionId === extensionId)
        .map((mount) => ({
          root: resolveArtifactMountRoot({ repoRoot, name: mount.name, mountPath: mount.relativePath }),
          mount: createSharedArtifactMount(deps, {
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
        }))
    : [];
  let connection: ReturnType<typeof createRelayConnection> | undefined;
  const watches: ReturnType<typeof watchArtifactMount>[] = [];
  const refreshFiles = async () => {
    const writableRoot = await resolveWorkspaceFilesPath(deps, { projectId: owner.workbenchId }, "write").catch(
      () => null,
    );
    if (writableRoot === repoRoot) await Promise.all(mounts.map(({ mount }) => mount.refresh()));
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
    connection = createRelayConnection({
      origin: config.relayOrigin,
      scope: adapter.scope,
      signal,
      access: async () => {
        const issued = await access();
        await adapter.initialize(revision);
        return issued;
      },
      synchronize: async (_attemptSignal) => {
        await refreshFiles();
        throw new Error("The journal relay cannot sync CRDT documents. Document transport is required.");
      },
      onError: () =>
        apiLogger.warn(
          { event: "relay.reconnecting", workbenchId: owner.workbenchId, extensionId },
          "Relay connection will retry",
        ),
    });
    return {
      owner,
      contextKey: input.contextKey,
      wake: connection.wake,
      done: connection.done,
      close: () => {
        for (const watch of watches) watch.close();
        controller.abort();
      },
    };
  } catch (error) {
    for (const watch of watches) watch.close();
    controller.abort();
    throw error;
  }
};
