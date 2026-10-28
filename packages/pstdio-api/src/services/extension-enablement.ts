import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import {
  AlwaysEnabledExtensionError,
  isAlwaysEnabledExtensionSource,
} from "../features/extensions/always-on-extensions";

type InstalledSource = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createInstalledExtensionSourcesDBService>["get"]>>
>;

export const createExtensionEnablement = (deps: {
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  emitExtensionInstance: (instance: unknown) => void;
  validateResourcePrefixes?: (projectId: string, source: InstalledSource) => Promise<void>;
}) => {
  const pendingClaims = new Map<string, Promise<unknown>>();
  const assertOptional = async (source: InstalledSource) => {
    if (await isAlwaysEnabledExtensionSource(source)) throw new AlwaysEnabledExtensionError();
  };

  // Check policy and claim as one serialized operation. Discovery and explicit
  // enablement cannot race an optional provider over a required one.
  const claimExtensionId = (instance: { id: string; scope_id: string }, source: InstalledSource) => {
    const key = JSON.stringify([instance.scope_id, source.extension_id]);
    const claim = (pendingClaims.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        for (const existing of await deps.installedExtensionSourcesService.list()) {
          if (existing.id !== source.id && existing.extension_id === source.extension_id)
            await assertOptional(existing);
        }
        const changed = await deps.extensionInstancesService.claimProjectExtensionProvider({
          extensionId: source.extension_id,
          instanceId: instance.id,
          projectId: instance.scope_id,
        });
        for (const item of changed) deps.emitExtensionInstance(item);
        return changed.find((item) => item.id === instance.id) ?? null;
      });
    pendingClaims.set(key, claim);
    void claim
      .finally(() => {
        if (pendingClaims.get(key) === claim) pendingClaims.delete(key);
      })
      .catch(() => {});
    return claim;
  };

  const setProjectExtensionEnabled = async (instanceId: string, enabled: boolean) => {
    const instance = await deps.extensionInstancesService.get(instanceId);
    if (!instance) return null;
    const source = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
    if (!source) return null;
    if (!enabled) await assertOptional(source);
    if (enabled && instance.scope_type === "project") {
      await deps.validateResourcePrefixes?.(instance.scope_id, source);
      return claimExtensionId(instance, source);
    }
    const updated = await deps.extensionInstancesService.update(instanceId, { enabled });
    if (updated) deps.emitExtensionInstance(updated);
    return updated;
  };

  return { assertOptional, claimExtensionId, setProjectExtensionEnabled };
};
