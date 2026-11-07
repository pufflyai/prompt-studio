import { expect, test } from "bun:test";
import type { KanbanRendererQueryParams } from "@pstdio/sdk/extensions";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createRow, pageRows, workload } from "storage-scale-fixture";
import { fixtureCommands, ownerStorageIndexes } from "./storage-scale-extension";
import { createScaleViews } from "./storage-scale-views";

const seeded = async () => {
  const storage = createMemoryStorage({ indexes: ownerStorageIndexes });
  const command = fixtureCommands[0];
  const run = (input: Parameters<typeof command.run>[1]["input"]) =>
    command.run(makeCommandContext({ storage, params: { input } }), { input });
  await run({
    action: "seed",
    operationId: "seed",
    rows: Array.from({ length: 1_000 }, (_, index) => createRow("small", 0, index, 3)),
  });
  return { storage, run };
};

test("fixture consumer reads one indexed page and its counts without materializing the owner", async () => {
  const { run } = await seeded();
  const page = await run({ action: "page", count: 1_000, selection: "pages", page: 1 });
  expect(page).toMatchObject({ capability: "indexed-query", materialized: 100, consumerScanned: 0, total: 1_000 });
  const rows = (page as { rows: { id: string }[] }).rows;
  expect(rows.map((row) => row.id)).toEqual(
    pageRows({ ...workload("small"), rows: 1_000 }, 0, "pages", 1).map((row) => row.id),
  );
  await run({ action: "commit", operationId: "delete", deleted: [createRow("small", 0, 9, 3).id] });
  expect(await run({ action: "aggregate", count: 1_000, selection: "focus" })).toMatchObject({
    selected: 99,
    total: 999,
  });
});

test("scale board view answers one bounded page through the page contract", async () => {
  const { storage } = await seeded();
  const board = createScaleViews("small", 0, 1_000).views[0];
  if (board.body.kind !== "kanban") throw new Error("Expected the board view");
  const query = board.body.query;
  const input = {
    page: { limit: 50, offset: 0, fields: ["summary"], search: "" },
    filter: { conjunction: "and", rules: [] },
    sorts: [],
  } as unknown as KanbanRendererQueryParams;
  const first = await query(makeCommandContext({ storage, params: {} }), input);
  const expected = pageRows({ ...workload("small"), rows: 1_000 }, 0, "focus", 0);
  expect(first.rows.map((row) => row.id)).toEqual(expected.slice(0, 50).map((row) => row.id));
  expect(first.page).toMatchObject({ total: 100, filteredTotal: 100 });
  const second = await query(makeCommandContext({ storage, params: {} }), {
    ...input,
    page: { ...input.page!, cursor: first.page!.cursor!, revision: first.page!.revision },
  });
  expect(second.rows.map((row) => row.id)).toEqual(expected.slice(50, 100).map((row) => row.id));
  await expect(query(makeCommandContext({ storage, params: {} }), { ...input, page: undefined })).rejects.toThrow(
    "bounded page contract",
  );
});
