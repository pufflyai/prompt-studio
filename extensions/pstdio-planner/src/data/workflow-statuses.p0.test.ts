import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { statusesCollection } from "./collections";
import { DEFAULT_STATUSES, seedDefaultStatuses } from "./seed";
import { readCompletedStatusIds } from "./workflow-statuses";

test("unconfigured completion avoids loading definitions after the defaults have been seeded", async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  const query = storage.records.query;
  const indexes: string[] = [];
  storage.records.query = (input) => {
    indexes.push(input.index);
    return query(input);
  };
  const ctx = makeCommandContext({ storage, params: {}, overrides: { settings: { all: async () => ({}) } } });

  expect(await readCompletedStatusIds(ctx)).toEqual([]);
  expect(indexes).not.toContain("definitions:ticket-statuses");
});

test("reading completion in a new project finishes default status writes", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { settings: { all: async () => ({}) } } });

  expect(await readCompletedStatusIds(ctx)).toEqual([]);
  for (const status of DEFAULT_STATUSES) expect(await statusesCollection(storage).get(status.id)).toEqual(status);
});

test("completion uses current definitions and ignores removed choices", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });

  expect(await readCompletedStatusIds(ctx)).toEqual(["done"]);
  await statusesCollection(storage).delete("done");
  expect(await readCompletedStatusIds(ctx)).toEqual([]);
});
