import type { RouteDeps } from "../deps";
import { AlwaysEnabledExtensionError } from "../extensions/always-on-extensions";

type Deps = Pick<RouteDeps, "extensionService" | "harnessRegistry">;

// Project creation starts optional sources disabled. Resolve installed harnesses before
// applying the explicit project selection, including sources not enabled there yet.
export const applyProjectHarnessSelection = async (
  deps: Deps,
  input: { projectId: string; selectedHarnessIds: string[] },
) => {
  const selected = new Set(input.selectedHarnessIds);
  const harnesses = await deps.harnessRegistry.list();

  const selectedByExtension = new Map<string, boolean>();
  for (const harness of harnesses) {
    const previous = selectedByExtension.get(harness.extensionId) ?? false;
    selectedByExtension.set(harness.extensionId, previous || selected.has(harness.id));
  }

  const instances = await deps.extensionService.listProjectExtensionInstances(input.projectId);
  for (const { installedSource, instance } of instances) {
    const enabled = selectedByExtension.get(installedSource.extension_id);
    if (enabled === undefined || enabled === instance.enabled) continue;
    try {
      await deps.extensionService.setProjectExtensionEnabled(instance.id, enabled);
    } catch (error) {
      // Host-required extensions stay enabled even when their harnesses are not selected.
      if (enabled || !(error instanceof AlwaysEnabledExtensionError)) throw error;
    }
  }
};
