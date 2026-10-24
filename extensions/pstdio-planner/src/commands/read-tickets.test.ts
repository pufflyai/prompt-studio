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

    const result = await readTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));

    expect(result.map((ticket) => ticket.shorthand)).toEqual(["T-early", "T-late"]);
    expect(result[0]).toMatchObject({
      content: "Ticket body",
      draft: true,
      files: [],
      tagIds: ["default-priority-high", "api", "ui"],
    });
    expect(result[0]).not.toHaveProperty("tags");
  });
});
