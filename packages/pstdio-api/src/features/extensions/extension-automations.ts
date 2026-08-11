import type { RuntimeScheduleRecord } from "pstdio-extensions";
import type { ExtensionsRouteDeps } from "./deps";

type AutomationPreferenceRow = { extension_instance_id: string; automation_id: string; enabled: boolean };

type EnabledSourceLike = {
  instance: { id: string };
  installedSource: { extension_id: string };
};

// A user preference row always wins; without one the author's `disabled` flag is
// the default, which makes automations enabled by default.
export const isAutomationEnabled = (
  schedule: Pick<RuntimeScheduleRecord, "id" | "disabled">,
  instanceId: string | undefined,
  preferences: AutomationPreferenceRow[],
) => {
  const preference = instanceId
    ? preferences.find((row) => row.extension_instance_id === instanceId && row.automation_id === schedule.id)
    : undefined;
  return preference ? preference.enabled : !schedule.disabled;
};

export const instanceIdsByExtensionId = (enabledSources: EnabledSourceLike[]) =>
  new Map(enabledSources.map(({ installedSource, instance }) => [installedSource.extension_id, instance.id]));

export const loadAutomationPreferences = async (deps: ExtensionsRouteDeps, projectId: string) =>
  deps.extensionAutomationPreferencesService.list(projectId);

export const buildAutomationRecords = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  runtime: { schedules: RuntimeScheduleRecord[] },
  enabledSources: EnabledSourceLike[],
) => {
  const preferences = await loadAutomationPreferences(deps, projectId);
  const instanceIds = instanceIdsByExtensionId(enabledSources);

  return runtime.schedules.map((schedule) => ({
    id: schedule.id,
    localId: schedule.localId,
    extensionId: schedule.extensionId,
    extensionInstanceId: instanceIds.get(schedule.extensionId),
    title: schedule.title,
    cron: schedule.cron,
    commandId: schedule.commandId,
    enabled: isAutomationEnabled(schedule, instanceIds.get(schedule.extensionId), preferences),
  }));
};
