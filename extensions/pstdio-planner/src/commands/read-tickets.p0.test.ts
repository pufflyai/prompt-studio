import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket } from "../data/ticket-context.fixture";

import type { Ticket } from "../data/types";
import { makeCommandArgs } from "./command-context.fixture";
import { readTicketsCommand } from "./read-tickets";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "Ticket",
  content: "Ticket body",
  statusId: null,
  tags: {},
  attachments: [],
  files: [],
  archived: false,
  sortOrder: 0,
  createdAt: "2026-06-08T10:00:00.000Z",
  updatedAt: "2026-06-08T10:05:00.000Z",
  ...overrides,
});

describe("readTicketsCommand", () => {
  test("returns full visible ticket records with flat tag IDs, ordered by sort order", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ shorthand: "T-late", sortOrder: 2 }));
    await putTicket(storage, makeTicket({ shorthand: "T-archived", archived: true, sortOrder: 1 }));
    await putTicket(
      storage,
      makeTicket({
        shorthand: "T-early",
        draft: true,
        sortOrder: 0,
        tags: { "default-priority": "default-priority-high", labels: ["api", "ui"] },
      }),
    );

    const { tickets: result } = await readTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));

    expect(result.map((ticket) => ticket.shorthand)).toEqual(["T-early", "T-late"]);
    expect(result[0]).toMatchObject({
      content: "Ticket body",
      draft: true,
      files: [],
    });
    expect(result[0]?.tagIds.toSorted()).toEqual(["api", "default-priority-high", "ui"]);
    expect(result[0]).not.toHaveProperty("tags");
  });
});

test("restarts a first-page ticket read across successive sync revisions", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, makeTicket({ shorthand: "T-local", sortOrder: 0 }));
  const remote = makeTicket({ shorthand: "T-synced", sortOrder: 1 });
  const later = makeTicket({ shorthand: "T-synced-later", sortOrder: 2 });
  const query = storage.records.query.bind(storage.records);
  let revisionChecks = 0;
  storage.records.query = async (input) => {
    if (input.index === "ticket-view" && input.revision && input.fields?.length === 0) {
      revisionChecks++;
      if (revisionChecks === 1) await putTicket(storage, remote);
      if (revisionChecks === 2) await putTicket(storage, later);
    }
    return query(input);
  };

  const result = await readTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));

  expect(revisionChecks).toBe(3);
  expect(result.total).toBe(3);
  expect(result.tickets.map(({ shorthand }) => shorthand)).toEqual(["T-local", "T-synced", "T-synced-later"]);
});

test("a stale continuation cannot silently mix rows from two revisions", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, makeTicket({ shorthand: "T-first", sortOrder: 0 }));
  await putTicket(storage, makeTicket({ shorthand: "T-second", sortOrder: 1 }));
  const first = await readTicketsCommand.run(...makeCommandArgs({ storage, params: { limit: 1 } }));
  expect(first.cursor).toBeString();
  const query = storage.records.query.bind(storage.records);
  let continuations = 0;
  storage.records.query = async (input) => {
    if (input.cursor) {
      continuations++;
      if (continuations === 1) await putTicket(storage, makeTicket({ shorthand: "T-new", sortOrder: 2 }));
    }
    return query(input);
  };

  await expect(
    readTicketsCommand.run(...makeCommandArgs({ storage, params: { limit: 1, cursor: first.cursor! } })),
  ).rejects.toThrow("stale");
  expect(continuations).toBe(1);
});

test("cancels a first-page read while synchronization keeps advancing its revision", async () => {
  const storage = createMemoryStorage();
  await putTicket(storage, makeTicket({ shorthand: "T-local" }));
  const controller = new AbortController();
  const query = storage.records.query.bind(storage.records);
  let revisionChecks = 0;
  storage.records.query = async (input) => {
    if (input.index === "ticket-view" && input.revision && input.fields?.length === 0) {
      revisionChecks++;
      await putTicket(storage, makeTicket({ shorthand: `T-synced-${revisionChecks}` }));
      if (revisionChecks === 2) controller.abort();
    }
    return query(input);
  };

  await expect(
    readTicketsCommand.run(...makeCommandArgs({ storage, params: {}, overrides: { signal: controller.signal } })),
  ).rejects.toThrow("aborted");
  expect(revisionChecks).toBe(2);
});
