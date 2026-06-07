import { describe, expect, test } from "bun:test";
import { putTicket } from "./collections";
import { createMemoryStorage } from "./memory-storage";
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

describe("runTicketsQuery", () => {
  test("returns visible ticket rows, status attributes, and board column configs", async () => {
    const storage = createMemoryStorage();
    const statuses = await seedDefaultStatuses(storage);
    const todo = statuses.find((status) => status.isDefault)!;

    await putTicket(storage, makeTicket({ shorthand: "T-1", title: "First", statusId: todo.id, sortOrder: 0 }));
    await putTicket(storage, makeTicket({ shorthand: "T-2", title: "Second", statusId: todo.id, sortOrder: 1 }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.rows.map((row) => row.title)).toEqual(["T-1 First", "T-2 Second"]);
    expect(result.attributes?.some((attribute) => attribute.id === "status")).toBe(true);
    expect(Object.keys(result.boardColumnConfigs ?? {})).toContain(todo.id);
  });

  test("excludes archived tickets", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await putTicket(storage, makeTicket({ shorthand: "T-1", archived: true }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.rows).toHaveLength(0);
  });

  test("seeds default statuses when the project has none yet", async () => {
    const storage = createMemoryStorage();
    // No explicit seed — the board must still get status columns.
    await putTicket(storage, makeTicket({ shorthand: "T-1" }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    const statusOptions = result.attributes?.find((attribute) => attribute.id === "status");
    expect(statusOptions?.type.kind).toBe("enum");
    expect(Object.keys(result.boardColumnConfigs ?? {}).length).toBeGreaterThan(0);
  });

  test("exposes default display property attributes", async () => {
    const storage = createMemoryStorage();
    await putTicket(
      storage,
      makeTicket({
        shorthand: "T-1",
        tagIds: ["default-priority-high", "default-type-bug"],
      }),
    );

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.attributes?.map((attribute) => attribute.id)).toEqual([
      "status",
      "updated",
      "id",
      "priority",
      "type",
    ]);
    expect(result.rows[0]?.attributes).toMatchObject({
      id: "T-1",
      priority: "default-priority-high",
      type: ["default-type-bug"],
    });
  });

  test("orders rows by sortOrder", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ shorthand: "T-late", sortOrder: 5 }));
    await putTicket(storage, makeTicket({ shorthand: "T-early", sortOrder: 1 }));

    const result = await runTicketsQuery({ storage, projectId: "proj-1" });

    expect(result.rows.map((row) => row.attributes.id)).toEqual(["T-early", "T-late"]);
  });
});
