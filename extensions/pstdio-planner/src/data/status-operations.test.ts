import { describe, expect, test } from "bun:test";
import { putStatus, putTicket, statusesCollection, ticketsCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { DEFAULT_STATUSES } from "./seed";
import {
  createTicketStatus,
  deleteTicketStatus,
  readTicketStatuses,
  reorderTicketStatuses,
  setDefaultStatus,
  updateTicketStatus,
} from "./status-operations";
import type { StoredTicket } from "./types";

const ticket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("ticket status operations", () => {
  test("readTicketStatuses seeds and returns defaults sorted", async () => {
    const storage = createMemoryStorage();

    const { statuses } = await readTicketStatuses(storage);

    expect(statuses.map((status) => status.name)).toEqual(DEFAULT_STATUSES.map((status) => status.name));
  });

  test("createTicketStatus appends a new column after the defaults", async () => {
    const storage = createMemoryStorage();

    const created = await createTicketStatus({ storage, name: "Blocked", color: "red" });

    expect(created).toMatchObject({ name: "Blocked", color: "red", isDefault: false, canCreate: false });
    const { statuses } = await readTicketStatuses(storage);
    expect(statuses.at(-1)?.id).toBe(created.id);
  });

  test("updateTicketStatus renames without losing board behavior flags", async () => {
    const storage = createMemoryStorage();
    const [first] = (await readTicketStatuses(storage)).statuses;

    const updated = await updateTicketStatus({ storage, statusId: first.id, name: "Renamed", color: "pink" });

    expect(updated).toMatchObject({ name: "Renamed", color: "pink", canDragIn: first.canDragIn });
  });

  test("updateTicketStatus persists a new sort order for reordering", async () => {
    const storage = createMemoryStorage();
    const [first] = (await readTicketStatuses(storage)).statuses;

    const updated = await updateTicketStatus({ storage, statusId: first.id, sortOrder: 99 });

    expect(updated.sortOrder).toBe(99);
    expect((await statusesCollection(storage).get(first.id))?.sortOrder).toBe(99);
  });

  test("updateTicketStatus updates the per-column action flags", async () => {
    const storage = createMemoryStorage();
    const [first] = (await readTicketStatuses(storage)).statuses;

    const updated = await updateTicketStatus({
      storage,
      statusId: first.id,
      canCreate: false,
      canDragIn: false,
      canDragOut: false,
      columnActions: ["archive_all"],
    });

    expect(updated).toMatchObject({
      name: first.name,
      canCreate: false,
      canDragIn: false,
      canDragOut: false,
      columnActions: ["archive_all"],
    });
  });

  test("createTicketStatus accepts optional action flags", async () => {
    const storage = createMemoryStorage();

    const created = await createTicketStatus({
      storage,
      name: "Done",
      canCreate: true,
      columnActions: ["archive_all"],
    });

    expect(created).toMatchObject({
      canCreate: true,
      canDragIn: true,
      canDragOut: true,
      columnActions: ["archive_all"],
    });
  });

  test("deleteTicketStatus reassigns its tickets to the default column", async () => {
    const storage = createMemoryStorage();
    const { statuses } = await readTicketStatuses(storage);
    const removed = statuses.find((status) => !status.isDefault)!;
    const fallback = statuses.find((status) => status.isDefault)!;
    await putTicket(storage, ticket({ id: "ticket-1", statusId: removed.id }));

    await deleteTicketStatus({ storage, statusId: removed.id });

    expect(await statusesCollection(storage).get(removed.id)).toBeUndefined();
    const stored = await ticketsCollection(storage).get("ticket-1");
    expect(stored?.statusId).toBe(fallback.id);
  });

  test("setDefaultStatus moves the default flag to the target column", async () => {
    const storage = createMemoryStorage();

    const { statuses } = await setDefaultStatus({ storage, statusId: "default-ready" });

    const defaults = statuses.filter((status) => status.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.id).toBe("default-ready");
  });

  test("setDefaultStatus throws for an unknown status", async () => {
    const storage = createMemoryStorage();
    await expect(setDefaultStatus({ storage, statusId: "ghost" })).rejects.toThrow(/Unknown ticket status/);
  });

  test("reorderTicketStatuses persists the requested order", async () => {
    const storage = createMemoryStorage();
    const { statuses } = await readTicketStatuses(storage);
    const reversed = statuses.map((status) => status.id).reverse();

    const result = await reorderTicketStatuses({ storage, statusIds: reversed });

    expect(result.statuses.map((status) => status.id)).toEqual(reversed);
  });

  test("reorderTicketStatuses appends omitted statuses with unique sort orders", async () => {
    const storage = createMemoryStorage();
    const { statuses } = await readTicketStatuses(storage);
    const omitted = await putStatus(storage, {
      ...statuses[0],
      id: "status-new",
      name: "New remote status",
      sortOrder: 0,
    });
    const requested = statuses.map((status) => status.id).reverse();

    const result = await reorderTicketStatuses({ storage, statusIds: requested });

    expect(result.statuses.map((status) => status.id)).toEqual([...requested, omitted.id]);
    expect(new Set(result.statuses.map((status) => status.sortOrder)).size).toBe(result.statuses.length);
  });
});
