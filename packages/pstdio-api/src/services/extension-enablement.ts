import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import {
  AlwaysEnabledExtensionError,
  isAlwaysEnabledExtensionSource,
} from "../features/extensions/always-on-extensions";

import { ExtensionUpgradeNeedsReviewError } from "../features/extensions/extension-upgrade-baseline";
import type { EnableInstalledSourceInput } from "./extension-service";

export const assertExpectedExtensionProvider = async (
  getProjectExtensionInstance: (
    projectId: string,
    instanceId: string,
  ) => Promise<{
    instance: { enabled: boolean };
    installedSource: { extension_id: string };
  } | null>,
  input: EnableInstalledSourceInput,
  expectedProvider: string | undefined,
) => {
  if (!expectedProvider) return;
  // The project choice lock held by the facade spans this check, registration and the claim.
  const expected = await getProjectExtensionInstance(input.projectId, expectedProvider);
  if (
    !expected?.instance.enabled ||
    canonicalExtensionId(expected.installedSource.extension_id) !== canonicalExtensionId(input.extensionId)
  )
    throw new ExtensionUpgradeNeedsReviewError("The active extension provider changed. Open a fresh upgrade review.");
};

type InstalledSource = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createInstalledExtensionSourcesDBService>["get"]>>
>;

export const createExtensionEnablement = (deps: {
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  emitExtensionInstance: (instance: unknown) => void;
  onDefaultAdopted: (sourcePath: string) => Promise<void>;
  validateResourcePrefixes?: (projectId: string, source: InstalledSource) => Promise<void>;
  assertProjectChoice?: (projectId: string, extensionId: string) => Promise<void>;
  isProjectExtensionManaged?: (projectId: string, extensionId: string) => Promise<boolean>;
}) => {
  const pendingClaims = new Map<string, Promise<unknown>>();
  const assertOptional = async (source: InstalledSource) => {
    if (await isAlwaysEnabledExtensionSource(source)) throw new AlwaysEnabledExtensionError();
  };

  const assertProviderAllowed = async (source: InstalledSource) => {
    for (const existing of await deps.installedExtensionSourcesService.list()) {
      if (existing.id !== source.id && canonicalExtensionId(existing.extension_id) === source.extension_id)
        await assertOptional(existing);
    }
  };

  // Check policy and claim as one serialized operation. Discovery and explicit
  // enablement cannot race an optional provider over a required one.
  const claimExtensionId = (instance: { id: string; scope_id: string }, source: InstalledSource) => {
    const key = JSON.stringify([instance.scope_id, source.extension_id]);
    const claim = (pendingClaims.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        await deps.assertProjectChoice?.(instance.scope_id, source.extension_id);
        await assertProviderAllowed(source);
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
    if (instance.scope_type === "project") await deps.assertProjectChoice?.(instance.scope_id, source.extension_id);
    if (!enabled) await assertOptional(source);
    if (instance.scope_type === "project")
      await deps.extensionInstancesService.recordProjectDefaultChoice(instance.scope_id, source.extension_id);
    if (enabled && instance.scope_type === "project") {
      await deps.validateResourcePrefixes?.(instance.scope_id, source);
      return claimExtensionId(instance, source);
    }
    const updated = await deps.extensionInstancesService.update(instanceId, { enabled });
    if (updated) deps.emitExtensionInstance(updated);
    return updated;
  };

  const adoptDefaultSourceForProject = async (projectId: string, installedSourceId: string) => {
    const source = await deps.installedExtensionSourcesService.get(installedSourceId);
    if (!source) return null;
    if (await deps.isProjectExtensionManaged?.(projectId, source.extension_id)) return null;
    if (await deps.extensionInstancesService.hasProjectDefaultChoice(projectId, source.extension_id)) return null;
    await deps.validateResourcePrefixes?.(projectId, source);
    const instance = await deps.extensionInstancesService.adoptProjectDefault({
      projectId,
      extensionId: source.extension_id,
      installedSourceId,
    });
    if (instance) {
      deps.emitExtensionInstance(instance);
      await deps.onDefaultAdopted(source.source_path);
    }
    return instance;
  };

  return {
    adoptDefaultSourceForProject,
    assertOptional,
    assertProviderAllowed,
    claimExtensionId,
    setProjectExtensionEnabled,
  };
};
