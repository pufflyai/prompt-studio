import { readFile } from "node:fs/promises";
import type { createEnvironmentDBService, createExtensionStorageDBService } from "pstdio-db";
import { createRelayAccess, createRelayAdapter, createRelayConnection, relayOrigin } from "pstdio-sync/relay";
import { canonicalJson, identitySchema } from "pstdio-sync-contracts";
import { z } from "zod";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { EventBus } from "../../features/sync/event-bus";
import { apiLogger } from "../../lib/logger";
import type { createAssetTransferService } from "../asset-transfer-service";

const connectionSchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  extensionId: identitySchema,
  environmentId: identitySchema,
  relayOrigin: z.string().transform(relayOrigin),
  managerOrigin: z.string().transform(relayOrigin),
  renewalGrant: z.string().min(1),
});
const configSchema = z.strictObject({ connections: z.array(connectionSchema) });

export const startRelayRuntime = async (input: {
  path?: string;
  environment: ReturnType<typeof createEnvironmentDBService>;
  storage: ReturnType<typeof createExtensionStorageDBService>;
  assets: ReturnType<typeof createAssetTransferService>;
  eventBus: EventBus;
}) => {
  if (!input.path) return { close: async () => {} };
  let config: z.infer<typeof configSchema>;
  try {
    config = configSchema.parse(JSON.parse(await readFile(input.path, "utf8")));
  } catch {
    throw new Error("Invalid native relay configuration");
  }
  const environment = await input.environment.get();
  const keys = new Set<string>();
  for (const connection of config.connections) {
    const key = JSON.stringify([connection.workbenchId, connection.extensionId]);
    if (connection.environmentId !== environment.environmentId || keys.has(key))
      throw new Error("Native relay owner mismatch");
    keys.add(key);
  }
  const controller = new AbortController();
  const signal = controller.signal;
  const connections = await Promise.all(
    config.connections.map(async (config) => {
      const owner = { workbenchId: config.workbenchId, extensionId: config.extensionId };
      const local = await input.storage.open({ owner, assets: createRecordAssets(input.assets, owner, signal) });
      const access = createRelayAccess({
        managerOrigin: config.managerOrigin,
        renewalGrant: config.renewalGrant,
        workbenchId: owner.workbenchId,
        signal,
      });
      const scope = { ...owner, accountId: config.accountId };
      const connection = createRelayConnection({
        origin: config.relayOrigin,
        scope,
        access,
        signal,
        synchronize: async (signal) => {
          const adapter = createRelayAdapter({
            origin: config.relayOrigin,
            scope,
            token: async () => (await access()).token,
            signal,
          });
          const before = await local.readState();
          await local.synchronize(adapter);
          const after = await local.readState();
          if (canonicalJson(before.accepted) !== canonicalJson(after.accepted))
            input.eventBus.emit("extension_events", "set", {
              id: crypto.randomUUID(),
              projectId: owner.workbenchId,
              eventId: `${owner.extensionId}.event.storage-changed`,
            });
        },
        onError: () =>
          apiLogger.warn(
            { event: "relay.reconnecting", workbenchId: owner.workbenchId, extensionId: owner.extensionId },
            "Relay connection will retry",
          ),
      });
      return { owner, ...connection };
    }),
  );
  const unsubscribe = input.storage.watch((owner) => {
    for (const connection of connections)
      if (connection.owner.workbenchId === owner.workbenchId && connection.owner.extensionId === owner.extensionId)
        connection.wake();
  });
  return {
    async close() {
      unsubscribe();
      controller.abort();
      await Promise.all(connections.map((connection) => connection.done));
    },
  };
};

export const connectAppRelay = async <
  T extends {
    deps: {
      environmentService: ReturnType<typeof createEnvironmentDBService>;
      extensionStorageService: ReturnType<typeof createExtensionStorageDBService>;
      assetTransferService: ReturnType<typeof createAssetTransferService>;
    };
    eventBus: EventBus;
    close: () => Promise<void>;
  },
>(
  app: T,
  path?: string,
) => {
  try {
    const relay = await startRelayRuntime({
      path,
      environment: app.deps.environmentService,
      storage: app.deps.extensionStorageService,
      assets: app.deps.assetTransferService,
      eventBus: app.eventBus,
    });
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
