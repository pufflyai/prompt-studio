import { historicalContributionId } from "pstdio-api-contracts/extension-host";
import { canonicalRuntimeId } from "pstdio-extensions";
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

export const listDeviceAutomations = async (deps: ExtensionsRouteDeps, projectId: string) => {
  const { runtime } = await deps.extensionRuntimeCatalog.get(projectId);
  const seen = new Set<string>();
  return (await (await openDeviceAutomations(deps, projectId)).records.list()).map((record) => {
    const definition = deviceAutomationSchema.parse(record.value);
    const scheduleId = canonicalRuntimeId(runtime, definition.scheduleId);
    if (seen.has(scheduleId)) throw new Error(`Conflicting automation assignments: ${scheduleId}`);
    seen.add(scheduleId);
    return { ...definition, scheduleId };
  });
};

export const scheduleIdentity = async (deps: ExtensionsRouteDeps, projectId: string, id: string) => {
  const { runtime } = await deps.extensionRuntimeCatalog.get(projectId);
  const scheduleId = canonicalRuntimeId(runtime, id);
  const schedule = runtime.schedules.find((entry) => entry.id === scheduleId);
  return {
    scheduleId,
    recordId: schedule
      ? (historicalContributionId({ extensionId: schedule.extensionId, kind: "schedule", id: schedule.localId }) ??
        scheduleId)
      : id,
  };
};

export const readDeviceAutomation = async (deps: ExtensionsRouteDeps, projectId: string, scheduleId: string) => {
  const identity = await scheduleIdentity(deps, projectId, scheduleId);
  const record = await readAssignment((await openDeviceAutomations(deps, projectId)).records, identity);
  return record.exists && !record.deleted
    ? { ...deviceAutomationSchema.parse(record.value), scheduleId: identity.scheduleId }
    : null;
};

type AutomationRecords = Parameters<
  Parameters<Awaited<ReturnType<typeof openDeviceAutomations>>["records"]["transaction"]>[0]
>[0];

const readAssignment = async (
  records: Pick<AutomationRecords, "read">,
  identity: { scheduleId: string; recordId: string },
) => {
  const previous = await records.read(identity.recordId);
  if (identity.recordId === identity.scheduleId) return previous;
  const current = await records.read(identity.scheduleId);
  if (previous.exists && current.exists) throw new Error(`Conflicting automation assignments: ${identity.scheduleId}`);
  return current.exists ? current : previous;
};

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
    const identity = await scheduleIdentity(deps, projectId, input.scheduleId);
    input = { ...input, scheduleId: identity.scheduleId };
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
      if ((await readAssignment(records, identity)).exists)
        throw new Error("This automation is already assigned to a device.");
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: identity.recordId, replace: definition }],
      });
    });
    return definition;
  });

export const setDeviceAutomationEnabled = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  input: { scheduleId: string; instanceId: string; enabled: boolean },
) => {
  const identity = await scheduleIdentity(deps, projectId, input.scheduleId);
  const { scheduleId } = identity;
  const { instanceId, enabled } = input;
  // Preferences and assignments share a local queue without nesting database transactions.
  return serializeAutomationChange(deps, projectId, async () => {
    // Read and edit under one lock so a sync import cannot make other fields stale.
    const assigned = await changeDeviceAutomations(deps, projectId, async (records) => {
      const record = await readAssignment(records, identity);
      if (!record.exists || record.deleted) return null;
      const definition = deviceAutomationSchema.parse(record.value);
      await records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: record.recordId, replace: { ...definition, scheduleId, enabled } }],
      });
      return { ...definition, scheduleId, enabled };
    });
    if (!assigned) {
      const matches = (await deps.extensionAutomationPreferencesService.list(projectId)).filter(
        (row) =>
          row.extension_instance_id === instanceId && [identity.recordId, scheduleId].includes(row.automation_id),
      );
      if (new Set(matches.map((row) => row.enabled)).size > 1)
        throw new Error(`Conflicting automation preferences: ${scheduleId}`);
      for (const id of matches.length ? matches.map((row) => row.automation_id) : [scheduleId])
        await deps.extensionAutomationPreferencesService.set({
          project_id: projectId,
          extension_instance_id: instanceId,
          automation_id: id,
          enabled,
        });
    }
    return assigned;
  });
};
