import { rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { resolvePstdioHome } from "../features/extensions/install-extension-source";
import type { EventBus } from "../features/sync/event-bus";

type UninstallProjectExtensionDeps = {
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  eventBus?: EventBus;
  notifyInstalledSourcesChanged: () => Promise<void>;
};

type UninstallProjectExtensionInput = {
  instanceId: string;
  projectId: string;
};

const isManagedInstalledSourcePath = (sourcePath: string) => {
  const extensionsRoot = resolve(join(resolvePstdioHome({ env: process.env }), "extensions"));
  const resolvedSourcePath = resolve(sourcePath);
  const relativePath = relative(extensionsRoot, resolvedSourcePath);

  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
};

const removeInstalledSourceFiles = (sourcePath: string) => {
  if (!isManagedInstalledSourcePath(sourcePath)) return;
  rmSync(sourcePath, { recursive: true, force: true });
};

export const uninstallProjectExtension = async (
  deps: UninstallProjectExtensionDeps,
  input: UninstallProjectExtensionInput,
) => {
  const instance = await deps.extensionInstancesService.get(input.instanceId);
  if (!instance) return null;
  if (instance.scope_type !== "project" || instance.scope_id !== input.projectId) return null;

  const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
  if (!installedSource) return null;

  removeInstalledSourceFiles(installedSource.source_path);

  const instances = await deps.extensionInstancesService.list({ installed_extension_id: installedSource.id });
  for (const extensionInstance of instances) {
    if (await deps.extensionInstancesService.remove(extensionInstance.id)) {
      deps.eventBus?.emit("extension_instances", "delete", { id: extensionInstance.id });
    }
  }

  if (await deps.installedExtensionSourcesService.remove(installedSource.id)) {
    deps.eventBus?.emit("installed_extension_sources", "delete", { id: installedSource.id });
    await deps.notifyInstalledSourcesChanged();
  }

  return { instance, installedSource };
};
