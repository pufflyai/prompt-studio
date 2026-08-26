import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { reorderTicketCommand } from "./reorder-ticket";

const ticketIdsBySortOrder = async (storage: ReturnType<typeof createMemoryStorage>) =>
  (await ticketsCollection(storage).list())
    .filter((ticket) => !ticket.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ticket) => ticket.id);

describe("reorderTicketCommand", () => {
  test("moves a ticket before a target ticket and persists sequential sort order", async () => {
    const storage = createMemoryStorage();
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const second = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Second" } }));
    const third = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Third" } }));

    await reorderTicketCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: third.id, beforeRowId: second.id } }),
    );

    expect(await ticketIdsBySortOrder(storage)).toEqual([first.id, third.id, second.id]);
    expect((await ticketsCollection(storage).get(first.id))?.sortOrder).toBe(0);
    expect((await ticketsCollection(storage).get(third.id))?.sortOrder).toBe(1);
    expect((await ticketsCollection(storage).get(second.id))?.sortOrder).toBe(2);
  });

  test("appends to the end when no target ticket is supplied", async () => {
    const storage = createMemoryStorage();
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const second = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Second" } }));
    const third = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Third" } }));

    await reorderTicketCommand.run(...makeCommandArgs({ storage, params: { rowId: first.id } }));

    expect(await ticketIdsBySortOrder(storage)).toEqual([second.id, third.id, first.id]);
  });

  test("ignores archived tickets when calculating visible board order", async () => {
    const storage = createMemoryStorage();
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const archived = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Archived" } }));
    const third = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Third" } }));
    await ticketsCollection(storage).put(archived.id, { ...archived, archived: true, sortOrder: 1 });

    await reorderTicketCommand.run(...makeCommandArgs({ storage, params: { rowId: third.id, beforeRowId: first.id } }));

    expect(await ticketIdsBySortOrder(storage)).toEqual([third.id, first.id]);
    expect((await ticketsCollection(storage).get(archived.id))?.sortOrder).toBe(1);
  });
});
