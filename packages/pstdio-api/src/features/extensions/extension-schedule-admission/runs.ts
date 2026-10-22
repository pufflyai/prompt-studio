import { z } from "zod";
import type { DeviceAutomation } from "../device-automations";

export const automationRunSchema = z.object({
  runId: z.string(),
  scheduleId: z.string(),
  scheduledFor: z.iso.datetime(),
  deviceId: z.string(),
  status: z.enum(["started", "completed", "failed", "skipped"]),
});
const automationRunsId = "pstdio.automation-runs";
export const automationRunId = (projectId: string, scheduleId: string, scheduledFor: string) =>
  `run:${JSON.stringify([projectId, scheduleId, scheduledFor])}`;

import type { ExtensionsRouteDeps } from "../deps";

const minute = (date: Date) => new Date(Math.floor(date.getTime() / 60_000) * 60_000);

// These records never join a relay connection. Claims and cursors belong to the
// executing environment, alongside the sessions/processes a command may create.
export const openAutomationRuns = (deps: ExtensionsRouteDeps, projectId: string) =>
  deps.extensionStorageService.open({ owner: { workbenchId: projectId, extensionId: automationRunsId } });

const createRunJournal = (deps: ExtensionsRouteDeps, projectId: string) => {
  let queue = Promise.resolve<unknown>(undefined);
  const serialize = <T>(action: () => Promise<T>) => {
    const result = queue.catch(() => {}).then(action);
    queue = result;
    return result;
  };
  const advance = async (definition: DeviceAutomation, cron: string, through: Date, dispatch: boolean) => {
    const storage = await openAutomationRuns(deps, projectId);
    const cursorId = JSON.stringify(["cursor", definition.scheduleId]);
    const records = new Map((await storage.records.list()).map((record) => [record.recordId, record]));
    const cursor = records.get(cursorId);
    const from = typeof cursor?.value === "string" ? new Date(cursor.value) : new Date(definition.startsAt);
    const end = minute(through);
    if (from >= end) return null;
    const edits: Parameters<typeof storage.records.commit>[0]["edits"] = [];
    for (let next = Bun.cron.parse(cron, from); next && next <= end; next = Bun.cron.parse(cron, next)) {
      const scheduledFor = next.toISOString();
      const runId = automationRunId(projectId, definition.scheduleId, scheduledFor);
      if (records.has(runId)) continue;
      const status = dispatch && next.getTime() === end.getTime() ? "started" : "skipped";
      edits.push({
        recordId: runId,
        replace: {
          runId,
          scheduleId: definition.scheduleId,
          scheduledFor,
          deviceId: definition.deviceId,
          status,
        },
      });
    }
    edits.push({
      recordId: cursorId,
      replace: end.toISOString(),
    });
    // A claim and its cursor are durable before command code can have effects.
    const outcome = await storage.records.commit({ operationId: crypto.randomUUID(), edits });
    if (outcome.status !== "saved-locally") throw new Error("Automation occurrence claim could not commit");
    const runId = automationRunId(projectId, definition.scheduleId, end.toISOString());
    return dispatch && edits.some((edit) => edit.recordId === runId) ? runId : null;
  };
  return {
    skipThrough: (definition: DeviceAutomation, cron: string, now: Date) =>
      serialize(() => advance(definition, cron, now, false)),
    claim: (definition: DeviceAutomation, cron: string, now: Date) =>
      serialize(() => advance(definition, cron, now, true)),
    finish: (runId: string | null, status: "completed" | "failed" | "skipped") =>
      serialize(async () => {
        if (!runId) return;
        const storage = await openAutomationRuns(deps, projectId);
        const record = await storage.records.read(runId);
        await storage.records.commit({
          operationId: crypto.randomUUID(),
          edits: [
            {
              recordId: runId,
              expectedRevision: record.revision,
              replace: { ...(record.value as Record<string, string>), status },
            },
          ],
        });
      }),
  };
};

const journalsByStorage = new WeakMap<
  ExtensionsRouteDeps["extensionStorageService"],
  Map<string, ReturnType<typeof createRunJournal>>
>();
export const createAutomationRunJournal = (deps: ExtensionsRouteDeps, projectId: string) => {
  let journals = journalsByStorage.get(deps.extensionStorageService);
  if (!journals) {
    journals = new Map();
    journalsByStorage.set(deps.extensionStorageService, journals);
  }
  let journal = journals.get(projectId);
  if (!journal) {
    journal = createRunJournal(deps, projectId);
    journals.set(projectId, journal);
  }
  return journal;
};
