import { createDocumentStorage } from "pstdio-sync";
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

const changeDeviceAutomations = <T>(
  deps: ExtensionsRouteDeps,
  projectId: string,
  change: (records: ReturnType<typeof createDocumentStorage>["records"]) => Promise<T>,
) => {
  const owner = { workbenchId: projectId, extensionId: deviceAutomationsOwnerId };
  return deps.extensionStorageService.documents.open("records").transaction(owner, async (state) => {
    const storage = createDocumentStorage({ owner, store: { transaction: async (_owner, action) => action(state) } });
    return change(storage.records);
  });
};

export const assignDeviceAutomation = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: { scheduleId: string; deviceId: string },
  now = new Date(),
) => {
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
};

export const setDeviceAutomationEnabled = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  scheduleId: string,
  enabled: boolean,
) => {
  // Read and edit under one lock so a sync import cannot make other fields stale.
  return changeDeviceAutomations(deps, projectId, async (records) => {
    const record = await records.read(scheduleId);
    if (!record.exists || record.deleted) return null;
    const definition = deviceAutomationSchema.parse(record.value);
    await records.commit({
      operationId: crypto.randomUUID(),
      edits: [{ recordId: scheduleId, replace: { ...definition, enabled } }],
    });
    return { ...definition, enabled };
  });
};
