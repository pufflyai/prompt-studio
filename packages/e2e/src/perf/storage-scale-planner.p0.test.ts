import { expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { compareRows, createRow, type FixtureRow, pageRows, workload } from "storage-scale-fixture";
import { fixtureCommands, plannerStorageIndexes } from "./storage-scale-extension";
import { extendPlannerSource } from "./storage-scale-runtime";

// Stands in for Planner's create-ticket command: it stores a ticket under an ID it chooses.
const plannerOwner = async (rows: FixtureRow[], count: number) => {
  const storage = createMemoryStorage({ indexes: plannerStorageIndexes });
  const command = fixtureCommands[0];
  const run = (input: Parameters<typeof command.run>[1]["input"]) =>
    command.run(makeCommandContext({ storage, params: { input } }), { input });
  await storage.collection("ticket-statuses").put("ready", { id: "ready", name: "Ready" });
  const tickets = rows.map((_, index) => `ticket-${index}`);
  for (const [index, id] of tickets.entries())
    await storage.collection("tickets").put(id, { id, title: rows[index].title, content: "", archived: false });
  await run({ action: "adopt", planner: true, rows, tickets, count });
  return { storage, run, tickets };
};

test("Planner keeps its ticket IDs while fixture edits find tickets by generator row", async () => {
  const { storage, run } = await plannerOwner([createRow("rich", 9, 37, 0)], 10_000);
  const before = await storage.records.list();
  const edited = createRow("rich", 9, 37, 3);
  await run({ action: "seed", planner: true, rows: [edited], count: 10_000, operationId: "edit" });
  expect((await storage.records.list()).map((row) => row.recordId)).toEqual(before.map((row) => row.recordId));
  expect(await storage.collection("tickets").get("ticket-0")).toMatchObject({
    id: "ticket-0",
    title: edited.title,
    statusId: "ready",
    scale: edited,
  });
  expect(await run({ action: "read", planner: true, id: edited.id })).toEqual(edited);
  expect(await storage.records.outcome("edit")).toMatchObject({ status: "saved-locally" });
});

test("Planner background commits update existing tickets with durable retry identities", async () => {
  const row = createRow("rich", 9, 83, 3);
  const { run } = await plannerOwner([row], 10_000);
  const changed = { ...row, title: "Incoming change" };
  const input = { action: "commit" as const, planner: true, rows: [changed], count: 10_000, operationId: "incoming" };
  await run(input);
  expect(await run({ action: "read", planner: true, id: row.id })).toEqual(changed);
  await run({ ...input, operationId: "later", rows: [{ ...changed, title: "Later change" }] });
  await run(input);
  expect(await run({ action: "read", planner: true, id: row.id })).toMatchObject({ title: "Later change" });
});

test("Planner fixture pages read only fixture tickets through the shared indexes", async () => {
  const rows = Array.from({ length: 400 }, (_, index) => createRow("rich", 9, index, 3)).sort(compareRows);
  const { run } = await plannerOwner(rows, 400);
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
