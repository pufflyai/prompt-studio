import { expect, test } from "bun:test";
import type { AutomationDefinition } from "pstdio-sync-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createAutomationRunJournal, openAutomationRuns } from "./runs";

test("concurrent scheduler owners cannot both claim an occurrence", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Clock" });
    const definition: AutomationDefinition = {
      kind: "definition",
      scheduleId: "clock.schedule.tick",
      extensionId: "clock",
      target: {
        workbenchId: project.id,
        environmentId: (await app.deps.environmentService.get()).environmentId,
        workspaceId: "local",
      },
      startsAt: "2026-10-19T09:00:00.000Z",
      enabled: true,
    };
    const journals = [
      createAutomationRunJournal(app.deps, project.id),
      createAutomationRunJournal(app.deps, project.id),
    ];
    const claims = await Promise.all(
      journals.map((journal) => journal.claim(definition, "* * * * *", new Date("2026-10-19T09:01:00.000Z"))),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await (await openAutomationRuns(app.deps, project.id)).records.conflicts()).toEqual([]);
  } finally {
    await app.close();
  }
});
