import { describe, expect, test } from "bun:test";
import { allocateTicketIdentity, putTicket, ticketsCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { moveTicketToInProgress } from "./move-to-in-progress";
import { seedDefaultStatuses } from "./seed";
import type { StoredTicket } from "./types";

const seedTicket = async (storage: ReturnType<typeof createMemoryStorage>, statusId: string) => {
  const now = new Date().toISOString();
  const { shorthand, sortOrder } = allocateTicketIdentity(await ticketsCollection(storage).list());
  return putTicket(storage, {
    id: crypto.randomUUID(),
    shorthand,
    title: "Ticket",
    content: "# Ticket",
    statusId,
    tagIds: [],
    attachments: [],
    parentId: null,
    dependsOn: null,
    blockedReason: null,
    userPrompt: null,
    parallelizable: null,
    draft: false,
    archived: false,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  } satisfies StoredTicket);
};

describe("moveTicketToInProgress", () => {
  test("moves a ticket into the in-progress column by id or shorthand", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage, "default-backlog");

    await moveTicketToInProgress(storage, ticket.shorthand);

    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("default-in-progress");
  });

  test("is a no-op when the ticket is already in progress", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await seedTicket(storage, "default-in-progress");
    const before = (await ticketsCollection(storage).get(ticket.id))!.updatedAt;

    await moveTicketToInProgress(storage, ticket.id);

    expect((await ticketsCollection(storage).get(ticket.id))!.updatedAt).toBe(before);
  });

  test("is a no-op for an unknown ticket", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    await expect(moveTicketToInProgress(storage, "T-999")).resolves.toBeUndefined();
  });

  test("leaves the ticket untouched when there is no in-progress column", async () => {
    const storage = createMemoryStorage();
    const ticket = await seedTicket(storage, "custom-status");

    await moveTicketToInProgress(storage, ticket.id);

    expect((await ticketsCollection(storage).get(ticket.id))!.statusId).toBe("custom-status");
  });
});
