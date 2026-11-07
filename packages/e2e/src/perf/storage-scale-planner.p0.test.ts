import { expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createRow, pageRows, workload } from "storage-scale-fixture";
import { fixtureCommands, plannerStorageIndexes } from "./storage-scale-extension";
import { extendPlannerSource } from "./storage-scale-runtime";

test("Planner fixture edits preserve discovered opaque collection addresses through public grouped commits", async () => {
  const storage = createMemoryStorage({ indexes: plannerStorageIndexes });
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
  const storage = createMemoryStorage({ indexes: plannerStorageIndexes });
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

test("Planner fixture pages read only fixture tickets through the shared indexes", async () => {
  const storage = createMemoryStorage({ indexes: plannerStorageIndexes });
  const command = fixtureCommands[0];
  const run = (input: Parameters<typeof command.run>[1]["input"]) =>
    command.run(makeCommandContext({ storage, params: { input } }), { input });
  await storage.collection("ticket-statuses").put("ready", { id: "ready", name: "Ready" });
  for (let index = 0; index < 400; index++)
    await run({
      action: "seed",
      planner: true,
      rows: [createRow("rich", 9, index, 0)],
      count: 400,
      operationId: `create-${index}`,
    });
  for (let start = 0; start < 400; start += 200) {
    const rows = Array.from({ length: 200 }, (_, offset) => createRow("rich", 9, start + offset, 3));
    await run({ action: "seed", planner: true, rows, count: 400, operationId: `edit-${start}` });
  }
  const page = await run({ action: "page", planner: true, count: 400, selection: "pages", page: 1 });
  expect(page).toMatchObject({ materialized: 100, total: 400, readAttempts: 1 });
  expect((page as { rows: { id: string }[] }).rows.map((row) => row.id)).toEqual(
    pageRows({ ...workload("rich"), rows: 400 }, 0, "pages", 1).map((row) => row.id.replace("row-0-", "row-9-")),
  );
});

test("extending Planner's entry is the same from its source and from an older extended entry", () => {
  const directory = mkdtempSync(join(tmpdir(), "scale-planner-entry-"));
  try {
    const entry = join(directory, "extension.ts");
    copyFileSync(join(import.meta.dirname, "../../../../extensions/pstdio-planner/extension.ts"), entry);
    extendPlannerSource(directory);
    const extended = readFileSync(entry, "utf8");
    expect(extended.match(/\.\.\.fixtureCommands,/g)).toHaveLength(1);
    expect(extended.match(/storageIndexes: plannerStorageIndexes/g)).toHaveLength(1);
    extendPlannerSource(directory);
    expect(readFileSync(entry, "utf8")).toBe(extended);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
