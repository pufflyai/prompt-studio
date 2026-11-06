import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { sortedByTicketOrder } from "../utils/sort";

import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { reorderTicketCommand } from "./reorder-ticket";

const ticketIdsByPosition = async (storage: ReturnType<typeof createMemoryStorage>) =>
  sortedByTicketOrder((await ticketsCollection(storage).list()).filter((ticket) => !ticket.archived)).map(
    (ticket) => ticket.id,
  );

describe("reorderTicketCommand", () => {
  test("moves a ticket before a target without rewriting its neighbors", async () => {
    const storage = createMemoryStorage();
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const second = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Second" } }));
    const third = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Third" } }));

    await reorderTicketCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: third.id, beforeRowId: second.id } }),
    );

    expect(await ticketIdsByPosition(storage)).toEqual([first.id, third.id, second.id]);
    expect((await ticketsCollection(storage).get(first.id))?.position).toBe(first.position);
    const moved = (await ticketsCollection(storage).get(third.id))!;
    expect(moved.position! > first.position!).toBe(true);
    expect(moved.position! < second.position!).toBe(true);
    expect((await ticketsCollection(storage).get(second.id))?.position).toBe(second.position);
  });

  test("appends to the end when no target ticket is supplied", async () => {
    const storage = createMemoryStorage();
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const second = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Second" } }));
    const third = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Third" } }));

    await reorderTicketCommand.run(...makeCommandArgs({ storage, params: { rowId: first.id } }));

    expect(await ticketIdsByPosition(storage)).toEqual([second.id, third.id, first.id]);
  });

  test("ignores archived tickets when calculating visible board order", async () => {
    const storage = createMemoryStorage();
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const archived = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Archived" } }));
    const third = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Third" } }));
    await ticketsCollection(storage).put(archived.id, { ...archived, archived: true });

    await reorderTicketCommand.run(...makeCommandArgs({ storage, params: { rowId: third.id, beforeRowId: first.id } }));

    expect(await ticketIdsByPosition(storage)).toEqual([third.id, first.id]);
    expect((await ticketsCollection(storage).get(archived.id))?.position).toBe(archived.position);
  });
});
