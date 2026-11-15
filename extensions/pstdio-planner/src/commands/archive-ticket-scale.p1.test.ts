import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedTicketIdentity } from "../data/ticket-context.fixture";
import type { Ticket } from "../data/types";
import { queuedRun } from "./archive-context.fixture";
import { archiveTicketColumnAction } from "./archive-ticket";
import { makeCommandContext } from "./command-context.fixture";

const row = (index: number): Ticket => ({
  id: `ticket-${String(index).padStart(4, "0")}`,
  shorthand: `T-${index + 1}`,
  title: `Ticket ${index}`,
  content: "Body ".repeat(1000),
  tags: {},
  archived: false,
  statusId: index < 205 ? "done" : "backlog",
  createdAt: "2026-11-14",
  updatedAt: "2026-11-14",
});

test("archive all selects bounded column pages and never reads unrelated tickets or workspaces", async () => {
  const rows = Array.from({ length: 5000 }, (_, index) => row(index));
  const storage = createMemoryStorage({
    collections: { tickets: Object.fromEntries(rows.map((ticket) => [ticket.id, ticket])) },
  });
  for (const ticket of rows.slice(0, 205)) seedTicketIdentity(storage, ticket);
  const original = storage.collection.bind(storage);
  const readIds: string[] = [];
  const commit = storage.records.commitIfCurrent;
  let largestBatch = 0,
    commitCount = 0;
  storage.records.commitIfCurrent = async (group) => {
    largestBatch = Math.max(largestBatch, group.edits.length);
    commitCount++;
    expect(group.edits.every((edit) => !edit.replace && edit.set?.["/value/archived"] === true)).toBe(true);
    return commit(group);
  };
  let writing = 0;
  let peak = 0;
  storage.collection = <T>(name: string) => {
    const collection = original<T>(name);
    if (name !== "tickets") return collection;
    const get = collection.get.bind(collection);
    const read = collection.read.bind(collection);
    const update = collection.updateIfUnchanged.bind(collection);
    collection.list = async () => {
      throw Error("Full ticket collection read");
    };
    collection.get = async (id: string) => {
      readIds.push(id);
      return get(id);
    };
    collection.read = async (id) => {
      readIds.push(id);
      return read(id);
    };
    collection.updateIfUnchanged = async (id, revision, value) => {
      writing++;
      peak = Math.max(peak, writing);
      try {
        await Promise.resolve();
        return await update(id, revision, value);
      } finally {
        writing--;
      }
    };
    return collection;
  };
  const ctx = makeCommandContext({
    storage,
    params: {},
    overrides: {
      automation: { enqueue: async () => queuedRun() },
      workspaces: {
        list: async () => {
          throw Error("Full workspace list");
        },
      },
    },
  });
  const result = await archiveTicketColumnAction(ctx, { columnId: "done", actionId: "archive_all" });
  expect(result).toEqual({ archivedCount: 205 });
  expect(peak).toBeLessThanOrEqual(8);
  expect(readIds).toEqual([]);
  expect(largestBatch).toBe(100);
  expect(commitCount).toBe(3);
  expect(readIds.every((id) => Number(id.slice(7)) < 205)).toBe(true);
  expect((await original<Ticket>("tickets").get(rows[204].id))?.archived).toBe(true);
  expect((await original<Ticket>("tickets").get(rows[205].id))?.archived).toBe(false);
});
