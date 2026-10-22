import type { RuntimeScheduleRecord } from "pstdio-extensions";
import type { ScheduleAdmissionDeps } from "../deps";
import { readDeviceAutomation } from "../device-automations";
import { instanceIdsByExtensionId, isAutomationEnabled } from "../extension-automations";
import type { ProjectExtensionRuntimeSnapshot } from "../project-extension-runtime-snapshot";

export const createScheduleAdmission = async (
  deps: ScheduleAdmissionDeps,
  projectId: string,
  snapshot: ProjectExtensionRuntimeSnapshot,
) => {
  const preferences = await deps.extensionAutomationPreferencesService.list(projectId);
  const instanceIds = instanceIdsByExtensionId(snapshot.enabledSources);
  return async (schedule: RuntimeScheduleRecord) => {
    const definition = await readDeviceAutomation(deps, projectId, schedule.id);
    if (definition) {
      if (!definition.enabled || definition.deviceId !== (await deps.environmentService.get()).environmentId)
        return null;
      return { definition, workspaceId: schedule.workspaceId };
    }
    // First download and account discovery must not turn an unassigned copy into a local job.
    if ((await deps.accountService.projectSyncStatus(projectId)).state !== "local") return null;
    if (!isAutomationEnabled(schedule, instanceIds.get(schedule.extensionId), preferences)) return null;
    return { definition: null, workspaceId: schedule.workspaceId };
  };
};
