import { expect, test } from "bun:test";
import { createMemoryStorageDevices, makeCommandContext } from "@pstdio/sdk/testing";
import extension from "./grouped-storage-extension";

const command = (id: string) => {
  const found = extension.commands?.find((entry) => entry.id === id);
  if (!found) throw new Error(`Acceptance command is unavailable: ${id}`);
  return found;
};

test("acceptance fixture drives offline shape edits, deterministic migration and concurrent card moves through public storage", async () => {
  const pair = await createMemoryStorageDevices();
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
    items: [
      { id: "a", title: "Edited A" },
      { id: "b", title: "Edited B" },
    ],
    body: "FIRST\nLAST",
  });
  expect(result.migrated).toHaveLength(2);
  expect(result.cards.map((row) => row.recordId).sort()).toEqual(["card-a", "card-b", "card-c"]);
  expect(new Set(result.cards.map((row) => row.value.position)).size).toBe(3);
});
