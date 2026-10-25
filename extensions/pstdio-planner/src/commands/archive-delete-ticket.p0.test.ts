import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createTicketFile, updateTicketFile } from "../data/file-operations";
import { runTicketsQuery } from "../data/query";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
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
    const result = await runTicketsQuery({
      ...ticketContext(storage),
      projectId: "proj-1",
      filter: { conjunction: "and", rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }] },
    });
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

  test("deletes the ticket's file bodies with the ticket", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));
    const file = await createTicketFile({ ...ticketContext(storage), ticketId: created.id, name: "plan.md" });
    await updateTicketFile({ ...ticketContext(storage), ticketId: created.id, fileId: file.id, content: "# Plan" });
    const blobs = storage.scope({ type: "resource", resource: { type: "ticket", id: created.id } }).files;
    expect(await blobs.list()).toHaveLength(1);

    await deleteTicketCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: created.id } } }),
    );

    expect(await blobs.list()).toEqual([]);
  });
});
