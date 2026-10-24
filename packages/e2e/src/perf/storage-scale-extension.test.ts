import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createRow } from "storage-scale-fixture";
import { fixtureCommands } from "./storage-scale-extension";

test("fixture consumer commits through the public API and reports all materialized rows", async () => {
  const storage = createMemoryStorage();
  const command = fixtureCommands[0];
  const run = (input: Parameters<typeof command.run>[1]["input"]) =>
    command.run(makeCommandContext({ storage, params: { input } }), { input });
  await run({
    action: "seed",
    operationId: "seed",
    rows: Array.from({ length: 1_000 }, (_, index) => createRow("small", 0, index, 3)),
  });
  const page = await run({ action: "page", count: 1_000, selection: "pages", page: 1 });
  expect(page).toMatchObject({
    capability: "legacy-list-scan",
    materialized: 1_000,
    scanned: null,
    consumerScanned: 1_000,
  });
  expect((page as { rows: unknown[] }).rows).toHaveLength(100);
  await run({ action: "commit", operationId: "delete", deleted: [createRow("small", 0, 37, 3).id] });
  const after = await run({ action: "page", count: 1_000 });
  expect(after).toMatchObject({ materialized: 999 });
});
