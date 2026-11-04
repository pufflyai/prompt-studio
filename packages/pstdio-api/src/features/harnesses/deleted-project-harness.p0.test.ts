import { expect, test } from "bun:test";
import { createProjectExtensionRuntimeCatalog } from "../extensions/project-extension-runtime-catalog";
import { ExtensionRuntimeProjectMissingError } from "../extensions/project-extension-runtime-snapshot";
import { createHarnessRegistryService } from "./harness-registry-service";
import { createTestHarnessRecord } from "./test-harness-registry";

test("a removed project releases its harness consumers during the next invalidation", async () => {
  const released = Promise.withResolvers<void>();
  let exists = true;
  const record = createTestHarnessRecord("worker", {
    provider: {
      dispose: () => {
        released.resolve();
      },
    },
  });
  const catalog = createProjectExtensionRuntimeCatalog({
    projectService: { get: async (id: string) => (exists ? { id, name: "Project", shorthand: "PS" } : null) } as never,
    extensionService: { listEnabledSourcesForProject: async () => [] } as never,
    workspaceService: { getDefault: async () => null } as never,
  });
  const service = createHarnessRegistryService({
    extensionRuntimeCatalog: {
      ...catalog,
      get: async (projectId) => ({ ...(await catalog.get(projectId)), runtime: { harnesses: [record] } }) as never,
    },
    installedExtensionSourcesService: { list: async () => [] } as never,
    installDefaultExtensions: async () => [],
  });
  try {
    const handle = (await service.get(record.id, { projectId: "removed" }))!;
    await handle.capabilities({ projectId: "removed" });
    exists = false;
    catalog.invalidate({ projectId: "removed", reason: "enablement_changed" });
    await expect(service.get(record.id, { projectId: "removed" })).rejects.toBeInstanceOf(
      ExtensionRuntimeProjectMissingError,
    );
    const stopped = await Promise.race([released.promise.then(() => true), Bun.sleep(10).then(() => false)]);
    expect(stopped).toBe(true);
    await expect(handle.capabilities({ projectId: "removed" })).rejects.toThrow("disposed");
  } finally {
    await service.dispose();
  }
});
