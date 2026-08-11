import { resolvePstdioRuntimeDescriptorPath as defaultResolveDescriptorPath } from "pstdio-paths";
import { resolveApiUrl as defaultResolveConfiguredApiUrl } from "../api-url";
import { discoverRuntime as defaultDiscoverRuntime, type RuntimeDiscovery } from "../runtime/runtime-descriptor";

type RootHelpRuntimeDeps = {
  discoverRuntime: (path: string) => Promise<RuntimeDiscovery>;
  resolveConfiguredApiUrl: () => string;
  resolveDescriptorPath: () => string;
};

const defaultDeps: RootHelpRuntimeDeps = {
  discoverRuntime: defaultDiscoverRuntime,
  resolveConfiguredApiUrl: defaultResolveConfiguredApiUrl,
  resolveDescriptorPath: defaultResolveDescriptorPath,
};

export const resolveRootHelpRuntime = async (
  requestedApiUrl: string | undefined,
  deps: RootHelpRuntimeDeps = defaultDeps,
) => {
  if (requestedApiUrl) return { apiUrl: requestedApiUrl };

  const discovery = await deps.discoverRuntime(deps.resolveDescriptorPath());
  if (discovery.state === "healthy") {
    return { apiUrl: discovery.descriptor.origin, token: discovery.descriptor.token };
  }

  return { apiUrl: deps.resolveConfiguredApiUrl() };
};
