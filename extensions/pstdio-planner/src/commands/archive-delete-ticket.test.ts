import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { runTicketsQuery } from "../data/query";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";

describe("archiveTicketCommand", () => {
  test("does not declare ticket identity as user input", () => {
    expect(archiveTicketCommand.params).toBeUndefined();
    expect(deleteTicketCommand.params).toBeUndefined();
  });

  test("archives a ticket so it drops off the board", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await archiveTicketCommand.run(makeCommandContext({ storage, params: { id: created.id } }));

    expect((await ticketsCollection(storage).get(created.id))?.archived).toBe(true);
    const result = await runTicketsQuery({ storage, projectId: "proj-1" });
    expect(result.rows).toHaveLength(0);
  });

  test("archives the active ticket resource", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await archiveTicketCommand.run(
      makeCommandContext({
        storage,
        params: {},
        overrides: { resource: { type: "ticket", id: created.id } },
      }),
    );

    expect((await ticketsCollection(storage).get(created.id))?.archived).toBe(true);
  });
});

describe("deleteTicketCommand", () => {
  test("removes a ticket from storage", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await deleteTicketCommand.run(makeCommandContext({ storage, params: { id: created.id } }));

    expect(await ticketsCollection(storage).get(created.id)).toBeUndefined();
  });

  test("deletes the active ticket resource", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await deleteTicketCommand.run(
      makeCommandContext({
        storage,
        params: {},
        overrides: { resource: { type: "ticket", id: created.id } },
      }),
    );

    expect(await ticketsCollection(storage).get(created.id)).toBeUndefined();
  });
});
