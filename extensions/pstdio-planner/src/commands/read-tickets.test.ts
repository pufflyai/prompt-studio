import { describe, expect, test } from "bun:test";
import { putTicket } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicket } from "../data/types";
import { makeCommandArgs } from "./command-context.fixture";
import { readTicketsCommand } from "./read-tickets";

const makeTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "Ticket",
  content: "Ticket body",
  statusId: null,
  tagIds: [],
  attachments: [],
  files: [],
  archived: false,
  sortOrder: 0,
  createdAt: "2026-06-08T10:00:00.000Z",
  updatedAt: "2026-06-08T10:05:00.000Z",
  ...overrides,
});

describe("readTicketsCommand", () => {
  test("returns full visible ticket records ordered by sort order", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ shorthand: "T-late", sortOrder: 2 }));
    await putTicket(storage, makeTicket({ shorthand: "T-archived", archived: true, sortOrder: 1 }));
    await putTicket(storage, makeTicket({ shorthand: "T-early", draft: true, sortOrder: 0 }));

    const result = await readTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));

    expect(result.map((ticket) => ticket.shorthand)).toEqual(["T-early", "T-late"]);
    expect(result[0]).toMatchObject({
      content: "Ticket body",
      draft: true,
      files: [],
      tagIds: [],
    });
  });
});
