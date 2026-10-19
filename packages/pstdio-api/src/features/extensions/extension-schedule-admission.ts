import type { RuntimeScheduleRecord } from "pstdio-extensions";
import { instanceIdsByExtensionId, isAutomationEnabled } from "./extension-automations";
import type { ProjectExtensionRuntimeSnapshot } from "./project-extension-runtime-snapshot";
import type { AutomationDeps } from "./synchronized-automations/catalog";
import { canRunAutomation, loadAutomationState } from "./synchronized-automations/state";

export const createScheduleAdmission = async (
  deps: AutomationDeps,
  projectId: string,
  snapshot: ProjectExtensionRuntimeSnapshot,
) => {
  const state = await loadAutomationState(deps, projectId);
  const preferences = await deps.extensionAutomationPreferencesService.list(projectId);
  const instanceIds = instanceIdsByExtensionId(snapshot.enabledSources);
  const admit = async (schedule: RuntimeScheduleRecord) => {
    if (state.shared.has(schedule.extensionId)) {
      const definition = state.definitions.get(schedule.id);
      if (!definition || state.disabledExtensions.has(schedule.extensionId)) return null;
      if (!(await canRunAutomation(deps, projectId, definition))) return null;
      if (schedule.workspaceId && schedule.workspaceId !== definition.target.workspaceId) return null;
      return { targeted: true as const, definition, workspaceId: definition.target.workspaceId };
    }
    if (!isAutomationEnabled(schedule, instanceIds.get(schedule.extensionId), preferences)) return null;
    return { targeted: false as const, definition: null, workspaceId: schedule.workspaceId };
  };
  return { admit, state };
};
