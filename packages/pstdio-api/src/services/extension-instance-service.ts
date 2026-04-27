import type { createExtensionInstancesDBService } from "pstdio-db";

export type ExtensionInstanceServiceDeps = {
  extensionInstancesDBService: ReturnType<typeof createExtensionInstancesDBService>;
};

export const createExtensionInstanceService = (deps: ExtensionInstanceServiceDeps) => ({
  ...deps.extensionInstancesDBService,
});
