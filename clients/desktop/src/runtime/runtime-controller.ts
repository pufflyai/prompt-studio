import type { RuntimeDescriptor, RuntimeDiscovery } from "pstdio/runtime";

export const DESKTOP_RUNTIME_TIMEOUT_MS = 15_000;
const DISCOVERY_INTERVAL_MS = 50;

export const createSidecarLaunchArguments = (instanceId: string) => [
  "serve",
  "--foreground",
  "--owner",
  "desktop",
  "--instance-id",
  instanceId,
  "--host",
  "127.0.0.1",
  "--port",
  "0",
];

type RuntimeDiscoveryDeps = {
  discover: (path: string) => Promise<RuntimeDiscovery>;
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
};

type RuntimeFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const verifyExternalRuntime = async (descriptor: RuntimeDescriptor, fetcher: RuntimeFetcher = fetch) => {
  const response = await fetcher(`${descriptor.origin}/runtime/ready`, {
    headers: { authorization: `Bearer ${descriptor.token}` },
  });
  const ready = response.ok ? ((await response.json()) as Record<string, unknown>) : null;
  if (
    ready?.ok !== true ||
    ready.protocolVersion !== descriptor.protocolVersion ||
    ready.instanceId !== descriptor.instanceId ||
    ready.ownerType !== descriptor.ownerType
  ) {
    throw new Error("External runtime identity did not match its isolated descriptor");
  }
  return descriptor;
};

export const waitForDesktopRuntime = async (
  descriptorPath: string,
  expectedInstanceId: string | null,
  deps: RuntimeDiscoveryDeps,
) => {
  const deadline = deps.now() + DESKTOP_RUNTIME_TIMEOUT_MS;
  while (deps.now() <= deadline) {
    const discovery = await deps.discover(descriptorPath);
    if (discovery.state === "healthy") {
      if (!expectedInstanceId || discovery.descriptor.instanceId === expectedInstanceId) return discovery.descriptor;
      throw new Error("A replacement runtime appeared while desktop was starting");
    }
    if (discovery.state === "unsafe") throw new Error(`Runtime ownership is unsafe: ${discovery.reason}`);
    await deps.sleep(DISCOVERY_INTERVAL_MS);
  }
  throw new Error("Runtime readiness timed out");
};

export const reconcileRuntimeOwnership = (current: RuntimeDescriptor, discovery: RuntimeDiscovery) => {
  if (discovery.state !== "healthy" || discovery.descriptor.instanceId !== current.instanceId) return current;
  return discovery.descriptor;
};

export const classifyRuntimeFailure = (detail: string) => {
  const normalized = detail.toLowerCase();
  if (normalized.includes("eaddrinuse") || normalized.includes("address already in use")) {
    return { code: "port_bind_failure" as const, message: "The local runtime could not bind its loopback port." };
  }
  if (normalized.includes("pglite") && (normalized.includes("lock") || normalized.includes("already owns"))) {
    return {
      code: "pglite_ownership_conflict" as const,
      message: "Another process still owns the Prompt Studio database.",
    };
  }
  if (normalized.includes("checkpoint") || normalized.includes("wal")) {
    return {
      code: "pglite_recovery_failure" as const,
      message: "Prompt Studio could not recover the database checkpoint safely.",
    };
  }
  return { code: "unexpected_exit" as const, message: "The Prompt Studio runtime stopped unexpectedly." };
};
