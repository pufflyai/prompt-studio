import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import type { EventBus } from "../features/sync/event-bus";

export type PruneProjectExtensionInstancesInput = {
  activeSourcePaths: string[];
  projectId: string;
  snapshotStartedAt?: string;
  sourcePathPrefix: string;
};

type PruneProjectExtensionInstancesDeps = {
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  eventBus?: EventBus;
  notifyInstalledSourcesChanged: () => Promise<void>;
};

type ExtensionInstance = Awaited<ReturnType<ReturnType<typeof createExtensionInstancesDBService>["list"]>>[number];

type InstalledSource = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createInstalledExtensionSourcesDBService>["get"]>>
>;

const isMissingFromDiscoveredSources = (
  installedSource: InstalledSource,
  input: PruneProjectExtensionInstancesInput,
  activeSourcePaths: Set<string>,
) => {
  const loadedAt = installedSource.last_loaded_at ?? installedSource.updated_at ?? installedSource.created_at;
  if (input.snapshotStartedAt && loadedAt >= input.snapshotStartedAt) return false;

  return (
    installedSource.source_path.startsWith(`${input.sourcePathPrefix}/`) &&
    !activeSourcePaths.has(installedSource.source_path)
  );
};

const removeProjectInstance = async (
  deps: PruneProjectExtensionInstancesDeps,
  instance: ExtensionInstance,
  installedSource: InstalledSource,
) => {
  const removed = await deps.extensionInstancesService.remove(instance.id);
  if (!removed) return null;

  deps.eventBus?.emit("extension_instances", "delete", { id: instance.id });
  return { instance, installedSource };
};

const pruneProjectInstance = async (
  deps: PruneProjectExtensionInstancesDeps,
  input: PruneProjectExtensionInstancesInput,
  activeSourcePaths: Set<string>,
  instance: ExtensionInstance,
) => {
  const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
  if (!installedSource) return null;
  if (!isMissingFromDiscoveredSources(installedSource, input, activeSourcePaths)) return null;

  return removeProjectInstance(deps, instance, installedSource);
};

const removeInstalledSourceWhenUnused = async (deps: PruneProjectExtensionInstancesDeps, installedSourceId: string) => {
  const remainingInstances = await deps.extensionInstancesService.list({
    installed_extension_id: installedSourceId,
  });
  if (remainingInstances.length > 0) return;

  const removed = await deps.installedExtensionSourcesService.remove(installedSourceId);
  if (!removed) return;

  deps.eventBus?.emit("installed_extension_sources", "delete", { id: installedSourceId });
  await deps.notifyInstalledSourcesChanged();
};

export const pruneProjectExtensionInstances = async (
  deps: PruneProjectExtensionInstancesDeps,
  input: PruneProjectExtensionInstancesInput,
) => {
  const activeSourcePaths = new Set(input.activeSourcePaths);
  const instances = await deps.extensionInstancesService.list({
    scope_id: input.projectId,
    scope_type: "project",
  });
  const removed = [];
  const maybeUnusedInstalledSourceIds = new Set<string>();

  for (const instance of instances) {
    const pruned = await pruneProjectInstance(deps, input, activeSourcePaths, instance);
    if (!pruned) continue;

    removed.push(pruned);
    maybeUnusedInstalledSourceIds.add(pruned.installedSource.id);
  }

  for (const installedSourceId of maybeUnusedInstalledSourceIds) {
    await removeInstalledSourceWhenUnused(deps, installedSourceId);
  }

  return removed;
};
