import { expect, test } from "bun:test";
import { createDeviceAutomationFixture } from "../device-automations.fixture";
import { automationRunId, createAutomationRunJournal, openAutomationRuns } from "./runs";

test("simultaneous journal owners share one durable claim per occurrence", async () => {
  const fixture = await createDeviceAutomationFixture();
  try {
    const { deps } = await fixture.device();
    const { environmentId: deviceId } = await deps.environmentService.get();
    const definition = {
      scheduleId: fixture.scheduleId,
      deviceId,
      startsAt: "2026-10-22T09:00:00.000Z",
      enabled: true,
    };
    const first = createAutomationRunJournal(deps, fixture.projectId);
    const second = createAutomationRunJournal(deps, fixture.projectId);
    const claims = await Promise.all(
      [first, second].map((journal) => journal.claim(definition, "* * * * *", new Date("2026-10-22T09:01:00Z"))),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
    const records = await (await openAutomationRuns(deps, fixture.projectId)).records.list("run:");
    expect(records).toHaveLength(1);
    expect(records[0]!.value).toMatchObject({ status: "started", deviceId });
  } finally {
    await fixture.close();
  }
});

test("claims read the cursor and current occurrence without loading unrelated history", async () => {
  const fixture = await createDeviceAutomationFixture();
  try {
    const { deps } = await fixture.device();
    const storage = await openAutomationRuns(deps, fixture.projectId);
    const definition = {
      scheduleId: fixture.scheduleId,
      deviceId: "device",
      startsAt: "2026-10-22T09:00:00.000Z",
      enabled: true,
    };
    const scheduledFor = "2026-10-22T09:01:00.000Z";
    const runId = automationRunId(fixture.projectId, fixture.scheduleId, scheduledFor);
    await storage.records.commit({
      operationId: "existing-claim",
      edits: [
        { recordId: runId, replace: { status: "completed" } },
        ...Array.from({ length: 200 }, (_, index) => ({
          recordId: `run:unrelated-${index}`,
          replace: { status: "completed" },
        })),
      ],
    });
    let recordsRead = 0;
    const open = deps.extensionStorageService.open;
    deps.extensionStorageService.open = async (input) => {
      const current = await open(input);
      return {
        ...current,
        records: {
          ...current.records,
          read: async (id) => {
            recordsRead++;
            return current.records.read(id);
          },
          list: async (prefix) => {
            const records = await current.records.list(prefix);
            recordsRead += records.length;
            return records;
          },
        },
      };
    };
    const journal = createAutomationRunJournal(deps, fixture.projectId);
    expect(await journal.claim(definition, "* * * * *", new Date(scheduledFor))).toBeNull();
    expect((await storage.records.read(runId)).value).toEqual({ status: "completed" });
    expect(await journal.claim(definition, "* * * * *", new Date("2026-10-22T09:02:00Z"))).toBeTruthy();
    expect(recordsRead).toBeLessThanOrEqual(4);
  } finally {
    await fixture.close();
  }
});
