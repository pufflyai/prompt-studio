import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { runTicketsQuery } from "../data/query";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";

describe("archiveTicketCommand", () => {
  test("archives a ticket so it drops off the board", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));

    await archiveTicketCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: created.id } } }),
    );

    expect((await ticketsCollection(storage).get(created.id))?.archived).toBe(true);
    const result = await runTicketsQuery({ storage, projectId: "proj-1" });
    expect(result.rows).toHaveLength(0);
  });
});

describe("deleteTicketCommand", () => {
  test("removes a ticket from storage", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));

    await deleteTicketCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: created.id } } }),
    );

    expect(await ticketsCollection(storage).get(created.id)).toBeUndefined();
  });
});
