import type { DeviceCommand } from "pstdio-api-contracts";
import {
  createDeviceCommandChannel,
  createDocumentRelayConnection,
  fetchSyncSpaces,
  type LiveConnection,
} from "pstdio-sync/relay";
import { jsonSchema } from "pstdio-sync-contracts";
import { apiLogger } from "../../lib/logger";
import type { RelayDeps } from "./deps";
import { withDeviceCommandAttachments } from "./device-command-attachments";
import { createDeviceCommandExecutor } from "./device-command-executor";
import type { RelayWorkbench } from "./runtime";

export const startDeviceCommands = (input: {
  config: RelayWorkbench;
  deps: RelayDeps;
  live: LiveConnection;
  access: () => Promise<{ token: string; expiresAt: string }>;
  signal: AbortSignal;
}) => {
  const { config, deps } = input;
  const controller = new AbortController();
  const signal = AbortSignal.any([input.signal, controller.signal]);
  let channel: ReturnType<typeof createDeviceCommandChannel> | undefined;
  const identity = async () => {
    const identity = await deps.accountService.commandIdentity();
    if (identity.accountId !== config.accountId || identity.deviceId !== config.environmentId)
      throw new Error("Device command identity changed");
    return identity;
  };
  const connection = createDocumentRelayConnection({
    ...input,
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    signal,
    synchronize: async () => {
      if (!channel)
        channel = createDeviceCommandChannel({
          live: input.live,
          identity,
          trustedKey: deps.accountService.deviceSigningKey,
          space: async () => (await fetchSyncSpaces({ ...config, credential: config.renewalGrant, signal })).personal,
          execute: createDeviceCommandExecutor(deps, config.workbenchId),
        });
      try {
        await channel.ready;
      } catch (error) {
        channel.close();
        channel = undefined;
        throw error;
      }
    },
    onError: () =>
      apiLogger.warn(
        { event: "relay.device_commands.unavailable", workbenchId: config.workbenchId },
        "Remote device actions will reconnect",
      ),
  });
  return {
    done: connection.done.finally(async () => {
      channel?.close();
      await channel?.drain();
    }),
    close() {
      controller.abort();
      channel?.close();
    },
    async call(deviceId: string, command: DeviceCommand, options: { signal: AbortSignal }) {
      if (!channel || !input.live.status().connected) throw new Error("Device disconnected");
      const send = (command: DeviceCommand) =>
        channel!.call(deviceId, jsonSchema.parse(JSON.parse(JSON.stringify(command))), options);
      return withDeviceCommandAttachments(deps, config.workbenchId, command, send);
    },
  };
};
