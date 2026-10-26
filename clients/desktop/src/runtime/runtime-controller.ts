import type { RuntimeDescriptor, RuntimeDiscovery } from "pstdio/runtime";

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
  signal: AbortSignal;
  sleep: (milliseconds: number) => Promise<void>;
};

type RuntimeFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export const verifyExternalRuntime = async (
  descriptor: RuntimeDescriptor,
  signal: AbortSignal,
  fetcher: RuntimeFetcher = fetch,
) => {
  const response = await fetcher(`${descriptor.origin}/runtime/ready`, {
    headers: { authorization: `Bearer ${descriptor.token}` },
    signal,
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
  while (true) {
    deps.signal.throwIfAborted();
    const discovery = await deps.discover(descriptorPath);
    deps.signal.throwIfAborted();
    if (discovery.state === "healthy" || discovery.state === "starting") {
      if (expectedInstanceId && discovery.descriptor.instanceId !== expectedInstanceId)
        throw new Error("A replacement runtime appeared while desktop was starting");
      if (discovery.state === "healthy") return discovery.descriptor;
    }
    if (discovery.state === "unsafe") throw new Error(`Runtime ownership is unsafe: ${discovery.reason}`);
    await deps.sleep(DISCOVERY_INTERVAL_MS);
  }
};

export const reconcileRuntimeOwnership = (current: RuntimeDescriptor, discovery: RuntimeDiscovery) => {
  if (discovery.state !== "healthy" || discovery.descriptor.instanceId !== current.instanceId) return current;
  return discovery.descriptor;
};

export const classifyRuntimeFailure = (detail: string) => {
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("eaddrinuse") ||
    normalized.includes("address already in use") ||
    /failed to start server\. is port \d+ in use\?/.test(normalized)
  ) {
    return { code: "port_bind_failure" as const, message: "The local runtime could not bind its loopback port." };
  }
  // The runtime's database lock reports another owner with these messages.
  if (normalized.includes("pstdio.db is in use") || normalized.includes("a legacy pstdio.db lock exists")) {
    return {
      code: "pglite_ownership_conflict" as const,
      message: "Another process still owns the Prompt Studio database.",
    };
  }
  const databaseOpenFailed = detail.split("\n").some((line) => {
    try {
      return JSON.parse(line)?.event === "db.open.failed";
    } catch {
      return false;
    }
  });
  if (databaseOpenFailed || normalized.includes("checkpoint") || normalized.includes("wal")) {
    return {
      code: "pglite_recovery_failure" as const,
      message: "Prompt Studio could not open its database safely.",
    };
  }
  return { code: "unexpected_exit" as const, message: "The Prompt Studio runtime stopped unexpectedly." };
};
