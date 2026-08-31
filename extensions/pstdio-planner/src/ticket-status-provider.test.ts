import { describe, expect, test } from "bun:test";
import { putTicket, statusesCollection, ticketsCollection } from "./data/collections";
import { createMemoryStorage } from "./data/memory-storage";
import type { StoredTicket } from "./data/types";
import { ticketStatuses } from "./ticket-status-provider";

const makeTicket = (statusId: string): StoredTicket => ({
  id: "ticket-1",
  shorthand: "T-1",
  title: "Ticket",
  content: "",
  statusId,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("ticketStatuses", () => {
  const context = (storage: ReturnType<typeof createMemoryStorage>) =>
    ({
      storage,
      events: { emit: async () => undefined },
    }) as never;

  test("seeds stored statuses without exposing board behavior", async () => {
    const storage = createMemoryStorage();

    const result = await ticketStatuses.query(context(storage));

    expect(result.statuses.find((status) => status.id === "backlog")).toMatchObject({
      isDefault: true,
      label: "Backlog",
    });
    expect(result.statuses.find((status) => status.id === "backlog")).not.toHaveProperty("board");
  });

  test("exposes create and column commands as status commands", async () => {
    const storage = createMemoryStorage();

    const result = await ticketStatuses.query(context(storage));

    expect(result.statuses.find((status) => status.id === "backlog")?.actions).toEqual(["create"]);
    expect(result.statuses.find((status) => status.id === "done")?.actions).toEqual(["archive_all"]);
    expect(result.statuses.find((status) => status.id === "ready")?.actions).toEqual([]);
  });

  test("stores create as canCreate and keeps the other commands apart", async () => {
    const storage = createMemoryStorage();
    const current = await ticketStatuses.query(context(storage));

    await ticketStatuses.save?.(context(storage), {
      statuses: current.statuses.map((status) =>
        status.id === "backlog" ? { ...status, actions: ["archive_all"] } : status,
      ),
    });

    const stored = statusesCollection(storage);
    expect(await stored.get("backlog")).toMatchObject({ canCreate: false, columnActions: ["archive_all"] });

    const reloaded = await ticketStatuses.query(context(storage));
    expect(reloaded.statuses.find((status) => status.id === "backlog")?.actions).toEqual(["archive_all"]);
  });

  test("reassigns tickets when the shared editor removes a status", async () => {
    const storage = createMemoryStorage();
    const current = await ticketStatuses.query(context(storage));
    await putTicket(storage, makeTicket("ready"));

    await ticketStatuses.save?.(context(storage), {
      statuses: current.statuses.filter((status) => status.id !== "ready"),
    });

    expect((await ticketsCollection(storage).get("ticket-1"))?.statusId).toBe("backlog");
  });

  test("preserves the drag rules the editor cannot reach", async () => {
    const storage = createMemoryStorage();
    const current = await ticketStatuses.query(context(storage));
    const done = current.statuses.find((status) => status.id === "done")!;

    await ticketStatuses.save?.(context(storage), {
      statuses: current.statuses.map((status) => (status.id === done.id ? { ...status, label: "Complete" } : status)),
    });

    expect(await statusesCollection(storage).get("done")).toMatchObject({
      name: "Complete",
      canDragIn: true,
      canDragOut: true,
      columnActions: ["archive_all"],
    });
  });
});
