import { expect, test } from "bun:test";
import { createDeviceAutomationFixture } from "../device-automations.fixture";
import { createAutomationRunJournal, openAutomationRuns } from "./runs";

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
