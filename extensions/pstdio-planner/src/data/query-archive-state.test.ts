import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket } from "./collections";
import { runTicketsQuery } from "./query";
import { seedDefaultStatuses } from "./seed";
import type { StoredTicket } from "./types";

const makeTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("runTicketsQuery archive filtering", () => {
  test.each([
    ["missing filters", undefined, ["Active", "Archived"]],
    ["empty filters", {}, ["Active", "Archived"]],
    ["other fields only", { priority: ["high"] }, ["Active", "Archived"]],
    ["empty archive selection", { archived: [] }, ["Active", "Archived"]],
    ["active only", { archived: ["active"] }, ["Active"]],
    ["archived only", { archived: ["archived"] }, ["Archived"]],
    ["active and archived", { archived: ["active", "archived"] }, ["Active", "Archived"]],
  ])("filters archive state for %s", async (_name, filters, expectedTitles) => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({ shorthand: "T-1", title: "Active", archived: false, sortOrder: 0 }));
    await putTicket(storage, makeTicket({ shorthand: "T-2", title: "Archived", archived: true, sortOrder: 1 }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1", filters });

    expect(result.rows.map((row) => row.title)).toEqual(expectedTitles);
  });
});
