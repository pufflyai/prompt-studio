import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createRow } from "storage-scale-fixture";
import { fixtureCommands } from "./storage-scale-extension";

test("Planner fixture edits preserve discovered opaque collection addresses through public grouped commits", async () => {
  const storage = createMemoryStorage();
  const command = fixtureCommands[0];
  const run = (input: Parameters<typeof command.run>[1]["input"]) =>
    command.run(makeCommandContext({ storage, params: { input } }), { input });
  const first = createRow("rich", 9, 37, 0);
  await run({ action: "seed", planner: true, rows: [first], count: 10_000, operationId: "create" });
  const before = await storage.records.list();
  const edited = createRow("rich", 9, 37, 3);
  await run({ action: "seed", planner: true, rows: [edited], count: 10_000, operationId: "edit" });
  expect((await storage.records.list()).map((row) => row.recordId)).toEqual(before.map((row) => row.recordId));
  expect(await storage.collection("tickets").get(first.id)).toMatchObject({ title: edited.title, history: 3 });
  expect(await storage.records.outcome("edit")).toMatchObject({ status: "saved-locally" });
});

test("Planner background commits update existing tickets with durable retry identities", async () => {
  const storage = createMemoryStorage();
  const command = fixtureCommands[0];
  const run = (input: Parameters<typeof command.run>[1]["input"]) =>
    command.run(makeCommandContext({ storage, params: { input } }), { input });
  const row = createRow("rich", 9, 83, 3);
  await run({ action: "seed", planner: true, rows: [{ ...row, history: 0 }], count: 10_000, operationId: "seed" });
  const changed = { ...row, title: "Incoming change" };
  const input = { action: "commit" as const, planner: true, rows: [changed], count: 10_000, operationId: "incoming" };
  await run(input);
  expect(await storage.records.outcome("incoming")).toMatchObject({ status: "saved-locally" });
  expect(await run({ action: "read", planner: true, id: row.id })).toMatchObject(changed);
  await run({ ...input, operationId: "later", rows: [{ ...changed, title: "Later change" }] });
  await run(input);
  expect(await run({ action: "read", planner: true, id: row.id })).toMatchObject({ title: "Later change" });
});
