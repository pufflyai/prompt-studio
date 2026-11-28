import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createTicketFile, updateTicketFile } from "../data/file-operations";
import { runTicketsQuery } from "../data/query.fixture";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
import { queuedRun } from "./archive-context.fixture";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { cleanupDeletedTicketCommand, deleteTicketCommand } from "./delete-ticket";

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

  test("dashboard deletion returns before deferred cleanup and the queued job removes the files", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Deferred cleanup" } }),
    );
    const file = await createTicketFile({ ...ticketContext(storage), ticketId: ticket.id, name: "plan.md" });
    await updateTicketFile({ ...ticketContext(storage), ticketId: ticket.id, fileId: file.id, content: "# Plan" });
    const blobs = storage.scope({ type: "resource", resource: { type: "ticket", id: ticket.id } }).files;
    const jobs: string[] = [];
    const signals: string[] = [];
    const ctx = makeCommandArgs({
      storage,
      params: {},
      overrides: { source: "dashboard", resource: { type: "ticket", id: ticket.id } },
    })[0];
    ctx.automation.enqueue = async (input) => {
      expect(input.command).toEqual(cleanupDeletedTicketCommand.ref);
      jobs.push(String(input.input.params?.ticketId));
      return queuedRun();
    };
    ctx.events.emit = async () => {
      signals.push("board changed");
      return { delivered: 0 };
    };
    ctx.resources.removed = async ({ id }) => {
      signals.push(id);
    };
    await expect(deleteTicketCommand.run(ctx, {})).resolves.toEqual({ id: ticket.id });
    expect(await ticketsCollection(storage).get(ticket.id)).toBeUndefined();
    expect(jobs).toEqual([ticket.id]);
    expect(signals).toEqual(["board changed"]);
    expect(await blobs.list()).toHaveLength(1);
    await cleanupDeletedTicketCommand.run(ctx, { ticketId: ticket.id });
    expect(signals).toEqual(["board changed", ticket.id]);
    expect(await blobs.list()).toEqual([]);
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
