import { readFile } from "node:fs/promises";
import type { createEnvironmentDBService } from "pstdio-db";
import { createRelayAccess, relayOrigin } from "pstdio-sync/relay";
import { identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { publishedExtensionsId } from "../../features/extensions/publication/catalog";
import { apiLogger } from "../../lib/logger";
import { startRelayExtension } from "./extension-owner";
import { startPublishedExtensions } from "./publications";

const workbenchSchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  environmentId: identitySchema,
  relayOrigin: z.string().transform(relayOrigin),
  managerOrigin: z.string().transform(relayOrigin),
  renewalGrant: z.string().min(1),
});
const configSchema = z.strictObject({ connections: z.array(workbenchSchema) });
export type RelayWorkbench = z.infer<typeof workbenchSchema>;
export const startRelayRuntime = async (input: {
  path?: string;
  environment: ReturnType<typeof createEnvironmentDBService>;
  deps: ExtensionsRouteDeps;
}) => {
  if (!input.path) return { close: async () => {} };
  let config: z.infer<typeof configSchema>;
  try {
    config = configSchema.parse(JSON.parse(await readFile(input.path, "utf8")));
  } catch {
    throw new Error("Invalid native relay configuration");
  }
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
  const publications = new Map<string, Awaited<ReturnType<typeof startPublishedExtensions>>>();
  for (const [id, config] of workbenches)
    publications.set(
      id,
      await startPublishedExtensions({ config, deps, signal: controller.signal, access: access.get(id)! }),
    );
  let retry: ReturnType<typeof setTimeout> | undefined;
  const reconcileWorkbench = async (workbenchId: string, config: RelayWorkbench) => {
    const snapshot = await deps.extensionRuntimeCatalog.get(workbenchId);
    if (controller.signal.aborted) return;
    const workspace = await deps.workspaceService.getDefault(workbenchId);
    const contextKey = JSON.stringify([
      snapshot.generation,
      workspace?.id,
      workspace?.root_path,
      workspace?.provider_capabilities_json,
    ]);
    const desired = new Set(snapshot.enabledSources.map(({ installedSource }) => installedSource.extension_id));
    for (const [key, connection] of connections)
      if (
        connection.owner.workbenchId === workbenchId &&
        (!desired.has(connection.owner.extensionId) || connection.contextKey !== contextKey)
      ) {
        connection.close();
        await connection.done;
        connections.delete(key);
      }
    for (const source of snapshot.enabledSources) {
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
      if (controller.signal.aborted) {
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
    if (owner.extensionId === publishedExtensionsId) {
      publications.get(owner.workbenchId)?.wake();
      return;
    }
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
    async close() {
      stopStorage();
      stopCatalog();
      stopEvents();
      clearTimeout(retry);
      controller.abort();
      for (const connection of connections.values()) connection.close();
      await running;
      await Promise.all([...publications.values()].map((connection) => connection.done));
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
) => {
  try {
    const relay = await startRelayRuntime({ path, environment: app.deps.environmentService, deps: app.deps });
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
