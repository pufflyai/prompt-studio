import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { runTicketsQuery } from "./query";
import { seedDefaultStatuses } from "./seed";
import { putTicket, ticketContext } from "./ticket-context.fixture";
import type { Ticket } from "./types";

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
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
  test("returns ticket rows with status enum options", async () => {
    const storage = createMemoryStorage();
    const statuses = await seedDefaultStatuses(storage);
    const todo = statuses.find((status) => status.isDefault)!;

    await putTicket(storage, makeTicket({ shorthand: "T-1", title: "First", statusId: todo.id, sortOrder: 0 }));
    await putTicket(storage, makeTicket({ shorthand: "T-2", title: "Second", statusId: todo.id, sortOrder: 1 }));

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });

    expect(result.rows.map((row) => row.title)).toEqual(["First", "Second"]);
    expect(result.attributes?.some((attribute) => attribute.id === "status")).toBe(true);
    expect(result.attributes?.find((attribute) => attribute.id === "status")?.type).toMatchObject({
      kind: "enum",
      options: expect.arrayContaining([expect.objectContaining({ value: "backlog" })]),
    });
    expect(result.boardColumnConfigs?.[todo.id]).toMatchObject({
      color: todo.color,
      canCreate: todo.canCreate,
    });
  });

  test("seeds status enum options when storage is empty", async () => {
    const storage = createMemoryStorage();
    // No explicit seed — the board must still get status columns.
    await putTicket(storage, makeTicket({ shorthand: "T-1" }));

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });

    expect(result.attributes?.find((attribute) => attribute.id === "status")?.type).toMatchObject({
      kind: "enum",
      options: expect.arrayContaining([expect.objectContaining({ value: "backlog" })]),
    });
    expect(result.boardColumnConfigs?.backlog?.canCreate).toBe(true);
  });

  test("returns stored workflow behavior as board column configs", async () => {
    const storage = createMemoryStorage();

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });
    expect(result.boardColumnConfigs?.done).toMatchObject({
      canCreate: false,
      actions: [{ id: "archive_all" }],
    });
  });

  test("exposes default display property attributes", async () => {
    const storage = createMemoryStorage();
    await putTicket(
      storage,
      makeTicket({
        shorthand: "T-1",
        tags: { "default-priority": "default-priority-high", "default-type": "default-type-bug" },
      }),
    );

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });

    expect(result.attributes?.map((attribute) => attribute.id)).toEqual([
      "status",
      "archived",
      "created",
      "updated",
      "id",
      "parent",
      "workspace",
      "priority",
      "type",
      "complexity",
      "milestone",
      "milestoneDate",
      "milestoneState",
      "needsAttention",
      "reviewRequests",
    ]);
    expect(result.rows[0]?.attributes).toMatchObject({
      archived: "active",
      created: "2026-01-01T00:00:00.000Z",
      id: "T-1",
      workspace: "",
      linkedResourceItems: [],
      priority: "default-priority-high",
      type: "default-type-bug",
      reviewRequests: "",
    });

    const typeAttribute = result.attributes?.find((attribute) => attribute.id === "type");
    expect(typeAttribute).toMatchObject({
      type: { kind: "enum" },
      editable: true,
    });
  });
});

describe("runTicketsQuery ordering and hierarchy", () => {
  test("orders rows by sortOrder", async () => {
    const storage = createMemoryStorage();
    await putTicket(storage, makeTicket({ shorthand: "T-late", sortOrder: 5 }));
    await putTicket(storage, makeTicket({ shorthand: "T-early", sortOrder: 1 }));

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });

    expect(result.rows.map((row) => row.attributes.id)).toEqual(["T-early", "T-late"]);
  });

  test("returns ancestry labels and immediate parent filter values", async () => {
    const storage = createMemoryStorage();
    const root = makeTicket({ id: "root", shorthand: "T-1", sortOrder: 0 });
    const child = makeTicket({ id: "child", shorthand: "T-2", parentId: root.id, sortOrder: 1 });
    const grandchild = makeTicket({ id: "grandchild", shorthand: "T-3", parentId: child.id, sortOrder: 2 });
    await putTicket(storage, root);
    await putTicket(storage, child);
    await putTicket(storage, grandchild);

    const result = await runTicketsQuery({ ...ticketContext(storage), projectId: "proj-1" });

    expect(result.rows.map((row) => row.attributes)).toEqual([
      expect.objectContaining({ id: "T-1", parent: "" }),
      expect.objectContaining({ id: "T-1 / T-2", parent: "T-1" }),
      expect.objectContaining({ id: "T-1 / T-2 / T-3", parent: "T-2" }),
    ]);
  });
});
