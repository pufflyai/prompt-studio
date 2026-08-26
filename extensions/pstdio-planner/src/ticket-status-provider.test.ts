import { describe, expect, test } from "bun:test";
import { putTicket, ticketsCollection } from "./data/collections";
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
  test("seeds stored statuses and exposes their board behavior", async () => {
    const storage = createMemoryStorage();

    const result = await ticketStatuses.query({ storage } as never);

    expect(result.statuses.find((status) => status.id === "backlog")).toMatchObject({
      isDefault: true,
      board: { canCreate: true, canDragIn: true, canDragOut: true, actions: [] },
    });
    expect(result.statuses.find((status) => status.id === "done")?.board?.actions).toEqual(["archive_all"]);
  });

  test("reassigns tickets when the shared editor removes a status", async () => {
    const storage = createMemoryStorage();
    const current = await ticketStatuses.query({ storage } as never);
    await putTicket(storage, makeTicket("ready"));

    await ticketStatuses.save?.({ storage } as never, {
      statuses: current.statuses.filter((status) => status.id !== "ready"),
    });

    expect((await ticketsCollection(storage).get("ticket-1"))?.statusId).toBe("backlog");
  });
});
