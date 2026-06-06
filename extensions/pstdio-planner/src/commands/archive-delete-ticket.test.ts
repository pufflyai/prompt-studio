import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { runTicketsQuery } from "../data/query";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";

describe("archiveTicketCommand", () => {
  test("archives a ticket so it drops off the board", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await archiveTicketCommand.run(makeCommandContext({ storage, params: { rowId: created.id } }));

    expect((await ticketsCollection(storage).get(created.id))?.archived).toBe(true);
    const result = await runTicketsQuery({ storage, projectId: "proj-1" });
    expect(result.rows).toHaveLength(0);
  });
});

describe("deleteTicketCommand", () => {
  test("removes a ticket from storage", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await deleteTicketCommand.run(makeCommandContext({ storage, params: { rowId: created.id } }));

    expect(await ticketsCollection(storage).get(created.id)).toBeUndefined();
  });
});
