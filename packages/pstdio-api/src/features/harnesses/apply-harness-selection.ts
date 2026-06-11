import type { RouteDeps } from "../deps";

type Deps = Pick<RouteDeps, "extensionService" | "harnessRegistry">;

// A project-create agent selection is a decision about harness extensions: extensions
// whose harnesses were all left unselected get their project instance disabled.
export const applyProjectHarnessSelection = async (
  deps: Deps,
  input: { projectId: string; selectedHarnessIds: string[] },
) => {
  const selected = new Set(input.selectedHarnessIds);
  const harnesses = await deps.harnessRegistry.list({ projectId: input.projectId });

  const selectedByExtension = new Map<string, boolean>();
  for (const harness of harnesses) {
    const previous = selectedByExtension.get(harness.extensionId) ?? false;
    selectedByExtension.set(harness.extensionId, previous || selected.has(harness.id));
  }

  const disabledExtensionIds = [...selectedByExtension.entries()]
    .filter(([, keep]) => !keep)
    .map(([extensionId]) => extensionId);
  if (disabledExtensionIds.length === 0) return;

  const instances = await deps.extensionService.listProjectExtensionInstances(input.projectId);
  for (const { installedSource, instance } of instances) {
    if (!disabledExtensionIds.includes(installedSource.extension_id)) continue;
    await deps.extensionService.setProjectExtensionEnabled(instance.id, false);
  }
};
