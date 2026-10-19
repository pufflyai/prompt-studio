import type { createEnvironmentDBService } from "pstdio-db";
import { createRelayAccess } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";
import { readPrivateFile } from "../account/private-file";
import { configSchema, type RelayWorkbench } from "./config";
import { startRelayExtension } from "./extension-owner";

export type { RelayWorkbench } from "./config";

export const startRelayRuntime = async (input: {
  path?: string;
  environment: ReturnType<typeof createEnvironmentDBService>;
  deps: ExtensionsRouteDeps;
}) => {
  const config = input.path
    ? await readPrivateFile(input.path, configSchema, { connections: [] })
    : { connections: [] };
  const identity = await input.environment.get();
  const workbenches = new Map<string, RelayWorkbench>();
  for (const connection of config.connections) {
    if (connection.environmentId !== identity.environmentId || workbenches.has(connection.workbenchId))
      throw new Error("Native relay owner mismatch");
    workbenches.set(connection.workbenchId, connection);
  }
  const controller = new AbortController();
  const { deps } = input;
  const connections = new Map<string, Awaited<ReturnType<typeof startRelayExtension>>>();
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
  const access = new Map(
    [...workbenches].map(([id, config]) => [id, createRelayAccess({ ...config, signal: controller.signal })]),
  );
  let retry: ReturnType<typeof setTimeout> | undefined;
  const reconcileWorkbench = async (workbenchId: string, config: RelayWorkbench) => {
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
      });
      if (controller.signal.aborted || workbenches.get(workbenchId) !== config) {
        connection.close();
        await connection.done;
        return;
      }
      connections.set(key, connection);
    }
  };
  const reconcile = async () => {
    for (const [workbenchId, config] of workbenches)
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
    notify(owner.workbenchId);
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
    async connect(connection: RelayWorkbench) {
      if (connection.environmentId !== identity.environmentId) throw new Error("Native relay owner mismatch");
      const previous = workbenches.get(connection.workbenchId);
      if (previous && canonicalJson(previous) === canonicalJson(connection)) return;
      if (
        previous &&
        (previous.accountId !== connection.accountId ||
          previous.managerOrigin !== connection.managerOrigin ||
          previous.relayOrigin !== connection.relayOrigin)
      )
        throw new Error("Native relay owner mismatch");
      // Only this workbench's credential changes; other live connections keep their owners.
      // Publish its owner before awaiting shutdown so an older in-flight start cannot take ownership.
      workbenches.set(connection.workbenchId, connection);
      access.set(connection.workbenchId, createRelayAccess({ ...connection, signal: controller.signal }));
      const obsolete = [...connections].filter(([, active]) => active.owner.workbenchId === connection.workbenchId);
      await Promise.all(obsolete.map(([key, active]) => stopConnection(key, active)));
      await refresh();
    },
    async close() {
      stopStorage();
      stopCatalog();
      stopEvents();
      clearTimeout(retry);
      controller.abort();
      for (const connection of connections.values()) connection.close();
      await running;
      await Promise.all([...connections.values()].map((connection) => connection.done));
    },
  };
};
export const connectAppRelay = async <
  T extends {
    deps: ExtensionsRouteDeps & { environmentService: ReturnType<typeof createEnvironmentDBService> };
    close: () => Promise<void>;
  },
>(
  app: T,
  path?: string,
  ready?: (connect: (connection: RelayWorkbench) => Promise<void>) => void,
) => {
  try {
    const relay = await startRelayRuntime({ path, environment: app.deps.environmentService, deps: app.deps });
    ready?.(relay.connect);
    return {
      ...app,
      close: async () => {
        try {
          await relay.close();
        } finally {
          await app.close();
        }
      },
    };
  } catch (error) {
    await app.close();
    throw error;
  }
};
