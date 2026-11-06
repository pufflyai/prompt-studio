import { createLiveConnection, createRelayAccess, type LiveConnection } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import { publishedExtensionsId } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { AccountRequestError } from "../account/native-account";
import { startAutomationSync } from "./automations";
import { startCoreDocumentSync } from "./core-documents";
import type { RelayDeps } from "./deps";
import { createDeviceCommandCaller } from "./device-command-call";
import { startDeviceCommands } from "./device-commands";
import { startRelayExtension } from "./extension-owner";
import { startRelayPersonalHistory } from "./personal";
import { projectSyncStatus } from "./project-status";
import { startPublishedExtensions } from "./publications";
import { createStorageChangeAnnouncer } from "./storage-changes";
import { createWorkbenchConnections } from "./workbench-connections";

export type RelayWorkbench = {
  accountId: string;
  workbenchId: string;
  environmentId: string;
  relayOrigin: string;
  managerOrigin: string;
  renewalGrant: string;
};

const assertLiveAvailable = (channel?: LiveConnection) => {
  if (channel?.status().protocolUnsupported)
    throw new AccountRequestError(
      "Update Prompt Studio or the relay to continue Cloud sync: the live channel version is unsupported.",
    );
  if (channel?.status().controlRefused)
    throw new AccountRequestError(
      "The relay's rate limits prevent Cloud subscriptions. Ask its operator to enable live requests, then reconnect Cloud.",
    );
};

const watchNativeSources = (
  deps: RelayDeps,
  connections: Map<string, Awaited<ReturnType<typeof startRelayExtension>>>,
) =>
  deps.nativeDocuments.sources.watch((owner, name) => {
    connections.get(JSON.stringify([owner.workbenchId, owner.extensionId]))?.wakeDocument(name);
  });

const watchRuntimeChanges = (deps: RelayDeps, refresh: () => Promise<void>) =>
  deps.eventBus.subscribe((event) => {
    if (["extension_instances", "installed_extension_sources", "projects", "workspaces"].includes(event.table))
      void refresh();
  });

const missingOwnerStatus = {
  firstDownloaded: false,
  downloaded: false,
  pending: false,
  needsAttention: false,
  connected: false,
  busy: false,
};
const projectOwnerProgress = (
  workbenchId: string,
  statuses: Parameters<typeof projectSyncStatus>[0],
  extensionIds: string[],
) => {
  const names = ["core", "publications", "automations", "personal", ...extensionIds];
  apiLogger.debug(
    {
      event: "relay.project.status",
      workbenchId,
      owners: statuses.map((status, index) => ({ owner: names[index], ...status })),
    },
    "Project data owner progress",
  );
  return projectSyncStatus(statuses);
};

// `denied` runs when the manager rejects a device credential, for example after another device removed this one.
// `statusChanged` runs when a project's sync status may have changed. Read `status` to get the new value.
export const startRelayRuntime = async (input: {
  deps: RelayDeps;
  denied?: () => void;
  statusChanged?: (workbenchId: string) => void;
}) => {
  const workbenches = new Map<string, RelayWorkbench>();
  const access = new Map<string, ReturnType<typeof createRelayAccess>>();
  const controller = new AbortController();
  const { deps } = input;
  const live = new Map<string, LiveConnection>();
  const connections = new Map<string, Awaited<ReturnType<typeof startRelayExtension>>>();
  const core = (config: RelayWorkbench) => ({
    config,
    deps,
    access: access.get(config.workbenchId)!,
    live: live.get(config.workbenchId)!,
    signal: controller.signal,
    statusChanged: () => statusChanged(config.workbenchId),
  });
  const publications = createWorkbenchConnections((config) => startPublishedExtensions(core(config)));
  const automations = createWorkbenchConnections((config) => startAutomationSync(core(config)));
  const personal = createWorkbenchConnections((config) => startRelayPersonalHistory(core(config)));
  const coreDocuments = createWorkbenchConnections((config) => startCoreDocumentSync(core(config)));
  const coreOwners = [publications, automations, personal, coreDocuments];
  const commands = createWorkbenchConnections((config) => startDeviceCommands(core(config)));
  const lifecycleOwners = [...coreOwners, commands];
  const stopConnection = async (key: string, connection: Awaited<ReturnType<typeof startRelayExtension>>) => {
    connection.close();
    await connection.done;
    if (connections.get(key) === connection) connections.delete(key);
  };
  let running: Promise<void> | undefined;
  let dirty = false;
  // Committed storage changes, local or downloaded, refresh the project's open views.
  const storageChanges = createStorageChangeAnnouncer(deps.eventBus);
  // Shutdown closes every connection. That is not a status change to announce.
  const statusChanged = (workbenchId: string) => {
    if (!controller.signal.aborted) input.statusChanged?.(workbenchId);
  };
  let retry: ReturnType<typeof setTimeout> | undefined;
  const reconcileWorkbench = async (workbenchId: string, config: RelayWorkbench) => {
    if (controller.signal.aborted || workbenches.get(workbenchId) !== config) return;
    for (const owners of lifecycleOwners) owners.ensure(config);
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
        live: live.get(workbenchId)!,
        deps,
        signal: controller.signal,
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
  const stopStorage = deps.extensionStorageService.watch((owner, origin) => {
    const documentId = owner.documentId;
    if (!workbenches.has(owner.workbenchId)) return;
    if (owner.extensionId === publishedExtensionsId) {
      publications.get(owner.workbenchId)?.wake();
      statusChanged(owner.workbenchId);
      return;
    }
    storageChanges.changed(owner.workbenchId);
    statusChanged(owner.workbenchId);
    // This owner's relay pass already owns these applied records. Views still
    // refresh, while genuinely local writes independently request another pass.
    if (origin === "relay") return;
    const connection = connections.get(JSON.stringify([owner.workbenchId, owner.extensionId]));
    if (connection) {
      if (documentId && documentId !== "records") connection.wakeDocument(documentId);
      else connection.wake();
    } else void refresh();
  });
  const stopCatalog = deps.extensionRuntimeCatalog.subscribeInvalidation(() => void refresh());
  const stopNativeSources = watchNativeSources(deps, connections);
  const stopEvents = watchRuntimeChanges(deps, refresh);
  await refresh();
  return {
    call: createDeviceCommandCaller(commands.get),
    async retry(workbenchId: string) {
      await refresh();
      personal.get(workbenchId)?.retry();
      publications.get(workbenchId)?.retry();
      automations.get(workbenchId)?.retry();
      coreDocuments.get(workbenchId)?.retry();
      for (const connection of connections.values())
        if (connection.owner.workbenchId === workbenchId) connection.retry();
    },
    // Every owner of project data reports: core resource numbers and each enabled extension.
    // An owner that has not started yet counts as not downloaded.
    async status(workbenchId: string) {
      assertLiveAvailable(live.get(workbenchId));
      const snapshot = await deps.extensionRuntimeCatalog.get(workbenchId);
      const owners = [
        coreDocuments.get(workbenchId),
        publications.get(workbenchId),
        automations.get(workbenchId),
        personal.get(workbenchId),
        ...snapshot.enabledSources.map(({ installedSource }) =>
          connections.get(JSON.stringify([workbenchId, installedSource.extension_id])),
        ),
      ];
      return projectOwnerProgress(
        workbenchId,
        await Promise.all(owners.map((owner) => owner?.status() ?? missingOwnerStatus)),
        snapshot.enabledSources.map(({ installedSource }) => installedSource.extension_id),
      );
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
      // Events emitted while owners drain must not recreate them on the old shared connection.
      for (const id of changed) {
        workbenches.delete(id);
        access.delete(id);
      }
      for (const id of changed) {
        for (const owners of lifecycleOwners) await owners.remove(id);
        // Closing the project's connection also ends its extension owners' runs before they stop below.
        live.get(id)?.close();
        live.delete(id);
      }
      // Publish new owners before awaiting shutdown so an older in-flight start cannot take ownership.
      for (const [id, connection] of desired)
        if (!workbenches.has(id)) {
          workbenches.set(id, connection);
          access.set(id, createRelayAccess({ ...connection, signal: controller.signal, denied: input.denied }));
          const channel = createLiveConnection({
            origin: connection.relayOrigin,
            projectId: id,
            access: access.get(id)!,
            signal: controller.signal,
            onStatusChange: () => statusChanged(id),
          });
          channel.discover(connection.accountId);
          live.set(id, channel);
        }
      const obsolete = [...connections].filter(([, active]) => changed.has(active.owner.workbenchId));
      await Promise.all(obsolete.map(([key, active]) => stopConnection(key, active)));
      for (const id of changed) statusChanged(id);
      await refresh();
    },
    async close() {
      stopStorage();
      stopCatalog();
      stopNativeSources();
      stopEvents();
      clearTimeout(retry);
      storageChanges.close();
      controller.abort();
      for (const owners of lifecycleOwners) owners.close();
      for (const connection of connections.values()) connection.close();
      await running;
      for (const owners of lifecycleOwners) await owners.done();
      await Promise.all([...connections.values()].map((connection) => connection.done));
      await Promise.all([...live.values()].map((channel) => channel.done));
      live.clear();
    },
  };
};
export const connectAppRelay = async <T extends { deps: RelayDeps; close: () => Promise<void> }>(
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
