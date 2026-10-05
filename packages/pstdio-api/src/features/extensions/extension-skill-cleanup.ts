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

// The skill catalog reads skill files from the source folder, so an edit on disk changes the
// catalog at once. Harness copies only follow on provision, so every project that runs the
// edited source re-provisions.
export const provisionWorkspacesUsingSource = async (deps: SkillRefreshDeps, sourcePath: string) => {
  for (const project of await deps.projectService.list()) {
    const enabledSources = await deps.extensionService.listEnabledSourcesForProject(project.id);
    const record = enabledSources.find(({ installedSource }) => installedSource.source_path === sourcePath);
    if (!record) continue;
    if (!(await extensionChangesWorkspaceProvisioning(deps, record.installedSource))) continue;
    await provisionProjectWorkspaces(deps, project.id);
  }
};
