import { workspaceEvents } from "pstdio-api-contracts/extension-kernel";
import { provisionProjectWorkspaces } from "../workspaces/provision-coordinator";
import type { ExtensionsRouteDeps } from "./deps";

type SkillRefreshDeps = ExtensionsRouteDeps;
type InstalledSource = Parameters<SkillRefreshDeps["extensionRuntimeCatalog"]["getInstalledSourceRuntime"]>[0];

export const extensionChangesWorkspaceProvisioning = async (
  deps: SkillRefreshDeps,
  installedSource: InstalledSource,
) => {
  try {
    const runtime = await deps.extensionRuntimeCatalog.getInstalledSourceRuntime(installedSource);
    return runtime.skills.length > 0 || runtime.hooks.some((hook) => hook.eventId === workspaceEvents.provision.id);
  } catch {
    // A broken extension must still be possible to disable. Keep the existing full
    // refresh behavior when its contributions cannot be inspected safely.
    return true;
  }
};

// Catalog-change entry point: re-provision so harness extensions sync their agent
// dirs to the current skill catalog and prune anything that left it.
export const refreshProjectSkillsInRepos = async (deps: SkillRefreshDeps, projectId: string) => {
  await provisionProjectWorkspaces(deps, projectId);
};
