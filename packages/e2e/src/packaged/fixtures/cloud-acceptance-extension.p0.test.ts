import { expect, test } from "bun:test";
import { createMemoryStorage, createMemoryStorageDevices, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "./grouped-storage-extension";

const command = (id: string) => {
  const found = extension.commands?.find((entry) => entry.id === id);
  if (!found) throw new Error(`Acceptance command is unavailable: ${id}`);
  return found;
};

test("acceptance fixture drives offline shape edits, deterministic migration and concurrent card moves through public storage", async () => {
  const pair = await createMemoryStorageDevices({
    textFields: extension.storage?.records?.text.map(({ prefix, fields }) => ({ prefix, fields: [...fields] })),
  });
  const contexts = pair.devices.map((storage) => makeCommandContext({ storage, params: {} }));
  const run = (index: number, id: string, params = {}) => command(id).run(contexts[index]!, params as never);
  await run(0, "seed-acceptance");
  await pair.merge();
  await run(0, "edit-acceptance", { side: "left" });
  await run(1, "edit-acceptance", { side: "right" });
  const leftMigration = await run(0, "migrate-acceptance");
  expect(await run(1, "migrate-acceptance")).toEqual(leftMigration);
  await run(0, "move-acceptance");
  await run(1, "move-acceptance");
  expect((await pair.merge()).map(({ recordId, path }) => ({ recordId, path }))).toEqual([
    { recordId: "card-a", path: ["value", "position"] },
    { recordId: "card-c", path: ["value", "position"] },
    { recordId: "shape", path: ["value", "items"] },
  ]);
  const rows = await Promise.all([run(0, "read-acceptance"), run(1, "read-acceptance")]);
  expect(rows[0]).toEqual(rows[1]);
  const result = rows[0] as unknown as {
    shape: { value: unknown };
    cards: { recordId: string; value: { position: string } }[];
    migrated: unknown[];
  };
  expect(result.shape.value).toEqual({
    title: "Left title",
    status: "right",
    nested: { left: 2, right: 2 },
    // Whole arrays keep the first save to reach Cloud; declared text merges both edits.
    items: [
      { id: "a", title: "Edited A" },
      { id: "b", title: "B" },
    ],
    body: "FIRST\nLAST",
  });
  expect(result.migrated).toHaveLength(2);
  expect(result.cards.map((row) => row.recordId).sort()).toEqual(["card-a", "card-b", "card-c"]);
  expect(new Set(result.cards.map((row) => row.value.position)).size).toBe(3);
});

// Verifies the fixture supplies the fixed public-edit workload without changing large values.
test("record revision preparation durably commits 126 distinct groups while preserving eight large values", async () => {
  const storage = createMemoryStorage();
  const context = makeCommandContext({ storage, params: {} });
  const edits = Array.from({ length: 8 }, (_, index) => ({
    recordId: `large-${index}`,
    replace: `value-${index}${"x".repeat(200_000)}`,
  }));
  await storage.records.commit({ operationId: "large-seed", edits });
  const result = (await command("advance-acceptance-revisions").run(context, { round: 2 } as never)) as unknown as {
    operationIds: string[];
  };
  expect(result).toBeDefined();
  expect(result.operationIds).toHaveLength(126);
  expect(new Set(result.operationIds).size).toBe(126);
  for (const id of result.operationIds) expect(await storage.records.outcome(id)).toMatchObject({ operationId: id });
  for (const edit of edits)
    expect(await storage.records.read(edit.recordId)).toMatchObject({
      value: edit.replace,
      shared: { kind: "map", value: { compactionTick: 377 } },
    });
});

// A bad fixture record must report every rejected save it admitted, then leave storage untouched.
test("marker preparation preserves admitted validation failures without partial record writes", async () => {
  const storage = createMemoryStorage();
  const context = makeCommandContext({ storage, params: {} });
  await storage.records.commit({
    operationId: "marker-validation-seed",
    edits: Array.from({ length: 8 }, (_, index) => ({
      recordId: `large-${index}`,
      replace: `unchanged-${index}`,
      ...(index === 0 ? { shared: [{ kind: "text.insert" as const, index: 0, text: "Text channel" }] } : {}),
    })),
  });
  const before = await storage.records.list();
  const failure = await Promise.resolve(
    command("advance-acceptance-revisions").run(context, { round: 0 } as never),
  ).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors.length).toBeGreaterThan(1);
  for (const error of (failure as AggregateError).errors) expect(error).toBeInstanceOf(Error);
  expect(await storage.records.list()).toEqual(before);
});
