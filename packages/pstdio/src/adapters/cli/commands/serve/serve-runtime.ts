import { randomBytes, randomUUID } from "node:crypto";
import type { RuntimeHost, RuntimeOwnerType } from "pstdio-api/runtime";
import { resolvePstdioRuntimeDescriptorPath } from "pstdio-paths";
import { CLI_VERSION } from "@/features/cli-version";
import {
  cleanupRuntimeDescriptor,
  promoteRuntimeDescriptor,
  type RuntimeDescriptor,
  writeRuntimeDescriptor,
} from "@/features/runtime/runtime-descriptor";

export type ServeRuntimeOptions = {
  ownerType?: RuntimeOwnerType;
  descriptorPath?: string;
  instanceId?: string;
  token?: string;
};

export const createServeRuntime = (options: ServeRuntimeOptions, shutdown: () => Promise<void>) => {
  if (!options.ownerType) return null;

  const instanceId = options.instanceId ?? randomUUID();
  const token = options.token ?? randomBytes(32).toString("base64url");
  const descriptorPath = options.descriptorPath ?? resolvePstdioRuntimeDescriptorPath();
  const listeners = new Set<Parameters<RuntimeHost["subscribe"]>[0]>();
  let ownerType = options.ownerType;
  let descriptor: RuntimeDescriptor | null = null;

  const host: RuntimeHost = {
    instanceId,
    token,
    origin: () => descriptor?.origin ?? null,
    ownerType: () => ownerType,
    promote: async () => {
      if (ownerType === "persistent") return;
      const promoted = promoteRuntimeDescriptor(descriptorPath, { pid: process.pid, instanceId });
      if (!promoted) {
        throw new Error("Runtime descriptor no longer belongs to this process instance");
      }
      descriptor = promoted;
      ownerType = "persistent";
    },
    announceShutdown: () => {
      const event = { type: "intentional_shutdown" as const, instanceId };
      for (const listener of listeners) listener(event);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    shutdown,
  };

  const publish = (origin: RuntimeDescriptor["origin"]) => {
    descriptor = {
      schemaVersion: 1,
      protocolVersion: 1,
      pid: process.pid,
      instanceId,
      ownerType,
      origin,
      token,
      appVersion: CLI_VERSION,
      startedAt: new Date().toISOString(),
    };
    writeRuntimeDescriptor(descriptorPath, descriptor);
    return descriptor;
  };

  const cleanup = () => {
    if (descriptor) cleanupRuntimeDescriptor(descriptorPath, descriptor);
  };

  return { cleanup, host, publish };
};
