import { z } from "zod";
import type { ExtensionsRouteDeps } from "./deps";
import { instanceIdsByExtensionId, isAutomationEnabled } from "./extension-automations";

export const deviceAutomationsOwnerId = "pstdio.automations";
export const deviceAutomationSchema = z.object({
  scheduleId: z.string().min(1),
  deviceId: z.string().min(1),
  enabled: z.boolean(),
  startsAt: z.iso.datetime(),
});
export type DeviceAutomation = z.infer<typeof deviceAutomationSchema>;

export const openDeviceAutomations = (deps: ExtensionsRouteDeps, projectId: string) =>
  deps.extensionStorageService.open({ owner: { workbenchId: projectId, extensionId: deviceAutomationsOwnerId } });

export const listDeviceAutomations = async (deps: ExtensionsRouteDeps, projectId: string) =>
  (await (await openDeviceAutomations(deps, projectId)).records.list()).map((record) =>
    deviceAutomationSchema.parse(record.value),
  );

export const readDeviceAutomation = async (deps: ExtensionsRouteDeps, projectId: string, scheduleId: string) => {
  const record = await (await openDeviceAutomations(deps, projectId)).records.read(scheduleId);
  return record.exists && !record.deleted ? deviceAutomationSchema.parse(record.value) : null;
};

type AutomationRecords = Parameters<
  Parameters<Awaited<ReturnType<typeof openDeviceAutomations>>["records"]["transaction"]>[0]
>[0];

// Reads and the following commit share one owner lock, so two assignments cannot both succeed.
const changeDeviceAutomations = async <T>(
  deps: ExtensionsRouteDeps,
  projectId: string,
  change: (records: AutomationRecords) => Promise<T>,
) => (await openDeviceAutomations(deps, projectId)).records.transaction(change);

const changes = new WeakMap<ExtensionsRouteDeps["extensionStorageService"], Map<string, Promise<unknown>>>();
const serializeAutomationChange = <T>(deps: ExtensionsRouteDeps, projectId: string, change: () => Promise<T>) => {
  let projects = changes.get(deps.extensionStorageService);
  if (!projects) {
    projects = new Map();
    changes.set(deps.extensionStorageService, projects);
  }
  const result = (projects.get(projectId) ?? Promise.resolve()).catch(() => {}).then(change);
  projects.set(projectId, result);
  const clear = () => {
    if (projects.get(projectId) === result) projects.delete(projectId);
  };
  void result.then(clear, clear);
  return result;
};

export const assignDeviceAutomation = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: { scheduleId: string; deviceId: string },
  now = new Date(),
) =>
  serializeAutomationChange(deps, projectId, async () => {
    const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
    const schedule = snapshot.runtime.schedules.find((schedule) => schedule.id === input.scheduleId);
    if (!schedule) throw new Error("Automation not found.");
    const preferences = await deps.extensionAutomationPreferencesService.list(projectId);
    const instanceId = instanceIdsByExtensionId(snapshot.enabledSources).get(schedule.extensionId);
    const definition = deviceAutomationSchema.parse({
      ...input,
      enabled: isAutomationEnabled(schedule, instanceId, preferences),
      startsAt: now.toISOString(),
    });
    // The document lock owns the initial check and save, even for concurrent API requests.
    await changeDeviceAutomations(deps, projectId, async (records) => {
      if ((await records.read(input.scheduleId)).exists)
        throw new Error("This automation is already assigned to a device.");
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: input.scheduleId, replace: definition }],
      });
    });
    return definition;
  });

export const setDeviceAutomationEnabled = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: { scheduleId: string; instanceId: string; enabled: boolean },
) => {
  const { scheduleId, instanceId, enabled } = input;
  // Preferences and assignments share a local queue without nesting database transactions.
  return serializeAutomationChange(deps, projectId, async () => {
    // Read and edit under one lock so a sync import cannot make other fields stale.
    const assigned = await changeDeviceAutomations(deps, projectId, async (records) => {
      const record = await records.read(scheduleId);
      if (!record.exists || record.deleted) return null;
      const definition = deviceAutomationSchema.parse(record.value);
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: scheduleId, replace: { ...definition, enabled } }],
      });
      return { ...definition, enabled };
    });
    if (!assigned)
      await deps.extensionAutomationPreferencesService.set({
        project_id: projectId,
        extension_instance_id: instanceId,
        automation_id: scheduleId,
        enabled,
      });
    return assigned;
  });
};
