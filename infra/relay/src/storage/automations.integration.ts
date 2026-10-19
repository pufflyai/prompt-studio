import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";
import { automationDefinitionId, automationsId, fingerprint, type Json, sealMutation } from "pstdio-sync-contracts";
import { createRelayStorage, migrateRelayStorage } from "./storage";

let storage: ReturnType<typeof createRelayStorage>;
beforeAll(async () => {
  await migrateRelayStorage(process.env.SYNC_TEST_DATABASE_URL!, resolve(import.meta.dir, "../../drizzle"));
  storage = createRelayStorage(process.env.SYNC_TEST_DATABASE_URL!, { complete: async () => true });
});
afterAll(async () => {
  await storage?.close();
});

test("the relay preserves exact automation targets, deduplicates delivery, and accepts a global disable from another environment", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: automationsId };
  const owner = await storage.initialize(scope, "automations-v1");
  const value = {
    kind: "definition",
    scheduleId: "clock.schedule.tick",
    extensionId: "clock",
    target: { workbenchId: scope.workbenchId, environmentId: "target", workspaceId: "local" },
    enabled: true,
    startsAt: "2026-10-19T09:00:00.000Z",
  };
  const recordId = automationDefinitionId(value.scheduleId);
  const change = async (environmentId: string, next: Json) => {
    const current = (await owner.snapshot()).records[recordId];
    return sealMutation({
      protocolVersion: 1,
      scope,
      operationId: crypto.randomUUID(),
      environmentId,
      parents: [],
      changes: [
        {
          recordId,
          expectedRevision: current?.revision ?? 0,
          baseDeleted: false,
          value: { expected: await fingerprint(current?.value ?? null), next },
        },
      ],
    });
  };
  const assignment = await change("target", value);
  expect((await owner.submit(assignment)).status).toBe("accepted");
  expect(await owner.submit(assignment)).toEqual(await owner.submit(assignment));
  const disable = await change("elsewhere", { ...value, enabled: false });
  expect((await owner.submit(disable)).status).toBe("accepted");
  await expect(
    owner.submit(await change("elsewhere", { ...value, target: { ...value.target, environmentId: "elsewhere" } })),
  ).rejects.toThrow("immutable");
  expect((await owner.snapshot()).records[recordId].value).toEqual({ ...value, enabled: false });
});
