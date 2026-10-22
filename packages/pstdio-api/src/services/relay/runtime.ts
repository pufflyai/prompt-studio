import { createRelayAccess } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { publishedExtensionsId } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { startRelayExtension } from "./extension-owner";
import { startRelayPersonalHistory } from "./personal";
import { projectSyncStatus } from "./project-status";
import { createPublicationConnections } from "./publication-connections";
import { startResourceNumberSync } from "./resource-numbers";

export type RelayWorkbench = {
  accountId: string;
  workbenchId: string;
  environmentId: string;
  relayOrigin: string;
  managerOrigin: string;
  renewalGrant: string;
};

// `denied` runs when the manager rejects a device credential, for example after another device removed this one.
// `statusChanged` runs when a project's sync status may have changed. Read `status` to get the new value.
export const startRelayRuntime = async (input: {
  deps: ExtensionsRouteDeps;
  denied?: () => void;
  statusChanged?: (workbenchId: string) => void;
}) => {
  const workbenches = new Map<string, RelayWorkbench>();
  const access = new Map<string, ReturnType<typeof createRelayAccess>>();
  const controller = new AbortController();
  const { deps } = input;
  const resourceConnections = new Map<string, ReturnType<typeof startResourceNumberSync>>();
  const connections = new Map<string, Awaited<ReturnType<typeof startRelayExtension>>>();
  const publications = createPublicationConnections({
    deps,
    signal: controller.signal,
    access: (id) => access.get(id)!,
    statusChanged: (id) => statusChanged(id),
  });
  const personal = new Map<string, ReturnType<typeof startRelayPersonalHistory>>();
  const stopConnection = async (key: string, connection: Awaited<ReturnType<typeof startRelayExtension>>) => {
    connection.close();
    await connection.done;
    if (connections.get(key) === connection) connections.delete(key);
  };
  let running: Promise<void> | undefined;
  let dirty = false;
  const notify = (workbenchId: string) =>
    deps.eventBus.emit("extension_events", "set", {
      id: crypto.randomUUID(),
      projectId: workbenchId,
      eventId: "pstdio.event.storage-changed",
    });
  // Shutdown closes every connection. That is not a status change to announce.
  const statusChanged = (workbenchId: string) => {
    if (!controller.signal.aborted) input.statusChanged?.(workbenchId);
  };
  let retry: ReturnType<typeof setTimeout> | undefined;
  const reconcileWorkbench = async (workbenchId: string, config: RelayWorkbench) => {
    publications.ensure(config);
    if (!personal.has(workbenchId))
      personal.set(
        workbenchId,
        startRelayPersonalHistory({ config, deps, signal: controller.signal, access: access.get(workbenchId)! }),
      );
    if (!resourceConnections.has(workbenchId))
      resourceConnections.set(
        workbenchId,
        startResourceNumberSync({
          config,
          deps,
          access: access.get(workbenchId)!,
          signal: controller.signal,
          statusChanged: () => statusChanged(workbenchId),
        }),
      );
    const snapshot = await deps.extensionRuntimeCatalog.get(workbenchId);
    if (controller.signal.aborted || workbenches.get(workbenchId) !== config) return;
    const workspace = await deps.workspaceService.getDefault(workbenchId);
    const contextKey = JSON.stringify([
      snapshot.generation,
      workspace?.id,
      workspace?.root_path,
      workspace?.provider_capabilities_json,
    ]);
    const desired = new Set(snapshot.enabledSources.map(({ installedSource }) => installedSource.extension_id));
    const obsolete = [...connections].filter(
      ([, connection]) =>
        connection.owner.workbenchId === workbenchId &&
        (!desired.has(connection.owner.extensionId) || connection.contextKey !== contextKey),
    );
    await Promise.all(obsolete.map(([key, connection]) => stopConnection(key, connection)));
    for (const source of snapshot.enabledSources) {
      if (workbenches.get(workbenchId) !== config) return;
      const key = JSON.stringify([workbenchId, source.installedSource.extension_id]);
      if (connections.has(key)) continue;
      const connection = await startRelayExtension({
        config,
        source,
        snapshot,
        contextKey,
        access: access.get(workbenchId)!,
        deps,
        signal: controller.signal,
        notify: () => notify(workbenchId),
        statusChanged: () => statusChanged(workbenchId),
      });
      if (controller.signal.aborted || workbenches.get(workbenchId) !== config) {
        connection.close();
        await connection.done;
        return;
      }
      connections.set(key, connection);
    }
    statusChanged(workbenchId);
  };
  const reconcile = async () => {
    for (const [workbenchId, config] of [...workbenches])
      await reconcileWorkbench(workbenchId, config).catch(() => {
        apiLogger.warn({ event: "relay.discovery.failed", workbenchId }, "Relay extension discovery will retry");
        if (!retry && !controller.signal.aborted)
          retry = setTimeout(() => {
            retry = undefined;
            void refresh();
          }, 1000);
      });
  };
  const refresh = () => {
    dirty = true;
    if (!running)
      running = (async () => {
        try {
          while (dirty && !controller.signal.aborted) {
            dirty = false;
            await reconcile();
          }
        } finally {
          running = undefined;
        }
      })();
    return running;
  };
  const stopStorage = deps.extensionStorageService.watch((owner) => {
    if (!workbenches.has(owner.workbenchId)) return;
    if (owner.extensionId === publishedExtensionsId) {
      publications.get(owner.workbenchId)?.wake();
      statusChanged(owner.workbenchId);
      return;
    }
    notify(owner.workbenchId);
    statusChanged(owner.workbenchId);
    const connection = connections.get(JSON.stringify([owner.workbenchId, owner.extensionId]));
    if (connection) connection.wake();
    else void refresh();
  });
  const stopCatalog = deps.extensionRuntimeCatalog.subscribeInvalidation(() => void refresh());
  const stopEvents = deps.eventBus.subscribe((event) => {
    if (["extension_instances", "installed_extension_sources", "projects", "workspaces"].includes(event.table))
      void refresh();
  });
  await refresh();
  return {
    // Every owner of project data reports: core resource numbers and each enabled extension.
    // An owner that has not started yet counts as not downloaded.
    async status(workbenchId: string) {
      const snapshot = await deps.extensionRuntimeCatalog.get(workbenchId);
      const owners = [
        resourceConnections.get(workbenchId),
        publications.get(workbenchId),
        ...snapshot.enabledSources.map(({ installedSource }) =>
          connections.get(JSON.stringify([workbenchId, installedSource.extension_id])),
        ),
      ];
      const missing = {
        firstDownloaded: false,
        downloaded: false,
        pending: false,
        needsAttention: false,
        connected: false,
        busy: false,
      };
      return projectSyncStatus(await Promise.all(owners.map((owner) => owner?.status() ?? missing)));
    },
    // Replaces the synced workbenches. Only workbenches whose login changed restart their connections.
    async update(next: RelayWorkbench[]) {
      await deps.personalHistoryService.refreshIdentity();
      const desired = new Map(next.map((connection) => [connection.workbenchId, connection]));
      const changed = new Set(
        [...workbenches]
          .filter(([id, current]) => canonicalJson(desired.get(id) ?? null) !== canonicalJson(current))
          .map(([id]) => id),
      );
      for (const id of changed) {
        await publications.remove(id);
        const previous = personal.get(id);
        previous?.close();
        if (previous) await previous.done;
        personal.delete(id);
        const resourceConnection = resourceConnections.get(id);
        resourceConnection?.close();
        await resourceConnection?.done;
        resourceConnections.delete(id);
        workbenches.delete(id);
        access.delete(id);
      }
      // Publish new owners before awaiting shutdown so an older in-flight start cannot take ownership.
      for (const [id, connection] of desired)
        if (!workbenches.has(id)) {
          workbenches.set(id, connection);
          access.set(id, createRelayAccess({ ...connection, signal: controller.signal, denied: input.denied }));
        }
      const obsolete = [...connections].filter(([, active]) => changed.has(active.owner.workbenchId));
      await Promise.all(obsolete.map(([key, active]) => stopConnection(key, active)));
      for (const id of changed) statusChanged(id);
      await refresh();
    },
    async close() {
      stopStorage();
      stopCatalog();
      stopEvents();
      clearTimeout(retry);
      controller.abort();
      publications.close();
      for (const connection of resourceConnections.values()) connection.close();
      for (const connection of connections.values()) connection.close();
      for (const connection of personal.values()) connection.close();
      await running;
      await publications.done();
      await Promise.all([...resourceConnections.values()].map((connection) => connection.done));
      await Promise.all([...connections.values()].map((connection) => connection.done));
      await Promise.all([...personal.values()].map((connection) => connection.done));
    },
  };
};
export const connectAppRelay = async <T extends { deps: ExtensionsRouteDeps; close: () => Promise<void> }>(
  app: T,
  account: {
    denied: () => void;
    statusChanged: (workbenchId: string) => void;
    ready: (relay: Awaited<ReturnType<typeof startRelayRuntime>>) => Promise<void>;
  },
) => {
  const close = async (relay?: Awaited<ReturnType<typeof startRelayRuntime>>) => {
    try {
      await relay?.close();
    } finally {
      await app.close();
    }
  };
  let relay: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  try {
    relay = await startRelayRuntime({ deps: app.deps, denied: account.denied, statusChanged: account.statusChanged });
    await account.ready(relay);
  } catch (error) {
    await close(relay);
    throw error;
  }
  return { ...app, close: () => close(relay) };
};
