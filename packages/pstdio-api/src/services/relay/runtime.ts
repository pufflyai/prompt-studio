import type { LiveConnection } from "pstdio-sync/relay";
import { resourceActivityOwnerId } from "../../features/activity/resource-activity-store";
import { seenOwnerId } from "../../features/activity/resource-seen";
import { publishedExtensionsId } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { AccountRequestError } from "../account/native-account";
import { isRecoveryCatalogOwner } from "../project-recovery/catalog";
import { startAutomationSync } from "./automations";
import { startCoreDocumentSync } from "./core-documents";
import { startCoreRecordSync } from "./core-records";
import type { RelayDeps } from "./deps";
import { createDeviceCommandCaller } from "./device-command-call";
import { startDeviceCommands } from "./device-commands";
import { extensionOwnerContextKey, startRelayExtension } from "./extension-owner";
import { startFolderRecovery } from "./folder-recovery";
import { startRelayPersonalHistory } from "./personal";
import { projectOwnerProgress, readOwnerStatus } from "./project-owner-progress";
import { createProjectSyncRetry } from "./project-sync-retry";
import { startPublishedExtensions } from "./publications";
import { createStorageChangeAnnouncer } from "./storage-changes";
import { createWorkbenchConnections } from "./workbench-connections";
import { type createWorkbenchAccess, createWorkbenchUpdates, drainOwnerStarts } from "./workbench-updates";

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

/** What other services call on one project: online device commands and its folder recovery owner. */
const projectEntryPoints = (
  commands: Parameters<typeof createDeviceCommandCaller>[0],
  folders: (workbenchId: string) => ReturnType<typeof startFolderRecovery> | undefined,
) => ({ call: createDeviceCommandCaller(commands), folders });

type ExtensionConnection = Awaited<ReturnType<typeof startRelayExtension>>;

const stopRelayConnection = async (
  connections: Map<string, ExtensionConnection>,
  key: string,
  connection: ExtensionConnection,
) => {
  try {
    connection.close();
    await connection.done;
  } finally {
    if (connections.get(key) === connection) connections.delete(key);
  }
};

// `denied` runs when the manager rejects a device credential, for example after another device removed this one.
// `statusChanged` runs when a project's sync status may have changed. Read `status` to get the new value.
interface RelayRuntimeInput {
  deps: RelayDeps;
  denied?: () => void;
  statusChanged?: (workbenchId: string) => void;
}

const createWorkbenchStatus =
  (input: {
    deps: RelayDeps;
    live: Map<string, LiveConnection>;
    coreOwners: { get(id: string): Parameters<typeof readOwnerStatus>[0] }[];
    connections: Map<string, ExtensionConnection>;
    recovery: { get(id: string): ReturnType<typeof startFolderRecovery> | undefined };
  }) =>
  async (id: string) => {
    assertLiveAvailable(input.live.get(id));
    const snapshot = await input.deps.extensionRuntimeCatalog.get(id);
    const enabled = snapshot.enabledSources.map(({ installedSource }) => installedSource);
    // An owner that has not started yet counts as not downloaded.
    const owners = [
      ...input.coreOwners.map((owner) => owner.get(id)),
      ...enabled.map(({ extension_id }) => input.connections.get(JSON.stringify([id, extension_id]))),
    ];
    return projectOwnerProgress(
      id,
      await Promise.all(owners.map(readOwnerStatus)),
      enabled.map(({ extension_id }) => extension_id),
      enabled.map(({ display_name }) => display_name),
      await input.recovery.get(id)?.folder(),
    );
  };

const privateChangesHandled = (
  config: RelayWorkbench,
  extensionId: string,
  origin: string | undefined,
  deps: RelayDeps,
) => {
  if (extensionId !== seenOwnerId(config)) return false;
  if (origin === "relay")
    deps.eventBus.emit("extension_events", "set", {
      id: crypto.randomUUID(),
      projectId: config.workbenchId,
      eventId: "pstdio.event.resource-seen-changed",
    });
  return true;
};

const createSeenConnections = (
  core: (config: RelayWorkbench) => Omit<Parameters<typeof startCoreRecordSync>[0], "ownerId">,
) =>
  createWorkbenchConnections((config) =>
    startCoreRecordSync({ ...core(config), ownerId: seenOwnerId(config), privateSpace: true }),
  );

export const startRelayRuntime = async (input: RelayRuntimeInput) => {
  const workbenches = new Map<string, RelayWorkbench>();
  const access = new Map<string, ReturnType<typeof createWorkbenchAccess>>();
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
  const activity = createWorkbenchConnections((config) =>
    startCoreRecordSync({ ...core(config), ownerId: resourceActivityOwnerId }),
  );
  const seen = createSeenConnections(core);
  const personal = createWorkbenchConnections((config) => startRelayPersonalHistory(core(config)));
  const coreDocuments = createWorkbenchConnections((config) => startCoreDocumentSync(core(config)));
  const coreOwners = [coreDocuments, publications, automations, activity, seen, personal];
  const commands = createWorkbenchConnections((config) => startDeviceCommands(core(config)));
  const recovery = createWorkbenchConnections((config) => startFolderRecovery(core(config)));
  const lifecycleOwners = [...coreOwners, commands, recovery];
  const stopConnection = (key: string, connection: ExtensionConnection) =>
    stopRelayConnection(connections, key, connection);
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
    const desired = new Map(
      snapshot.enabledSources.map((source) => [
        source.installedSource.extension_id,
        extensionOwnerContextKey({ source, snapshot, workspace }),
      ]),
    );
    const obsolete = [...connections].filter(
      ([, connection]) =>
        connection.owner.workbenchId === workbenchId &&
        connection.contextKey !== desired.get(connection.owner.extensionId),
    );
    await Promise.all(obsolete.map(([key, connection]) => stopConnection(key, connection)));
    // Folder lookup and preparation belong to each owner; one slow source must not delay the others.
    await drainOwnerStarts(
      snapshot.enabledSources.map(async (source) => {
        if (workbenches.get(workbenchId) !== config) return;
        const key = JSON.stringify([workbenchId, source.installedSource.extension_id]);
        const current = connections.get(key);
        if (current) {
          const files = workspace?.provider_capabilities_json?.files;
          if (workspace && (!files || files === "write")) current.resumeArtifactWatches?.();
          return;
        }
        const connection = await startRelayExtension({
          config,
          source,
          snapshot,
          contextKey: desired.get(source.installedSource.extension_id)!,
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
      }),
    );
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
    const config = workbenches.get(owner.workbenchId);
    if (!config || isRecoveryCatalogOwner(owner.extensionId)) return;
    if (privateChangesHandled(config, owner.extensionId, origin, deps)) return;
    if (owner.extensionId === publishedExtensionsId) {
      publications.get(owner.workbenchId)?.wake();
      statusChanged(owner.workbenchId);
      return;
    }
    storageChanges.changed(owner.workbenchId, owner);
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
  const updates = createWorkbenchUpdates({
    deps,
    workbenches,
    access,
    live,
    connections,
    lifecycleOwners,
    stopConnection,
    signal: controller.signal,
    statusChanged,
    refresh,
    denied: input.denied,
  });
  await refresh();
  return {
    ...projectEntryPoints(commands.get, recovery.get),
    retry: createProjectSyncRetry({
      refresh,
      owners: { core: coreDocuments, publications, automations, activity, seen, personal },
      folders: recovery,
      extensions: connections,
    }),
    status: createWorkbenchStatus({ deps, live, coreOwners, connections, recovery }),
    update: updates.update,
    withdraw: updates.withdraw,
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
      await Promise.all([running, updates.done()]);
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
