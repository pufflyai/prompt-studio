import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { plannerTicketsChanged } from "../events";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketsCommand } from "./list-tickets";
import { unarchiveTicketCommand } from "./unarchive-ticket";

const ticketResource = (id: string) => ({ type: "ticket", id });

const seedArchivedTicket = async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  await seedDefaultTags(storage);
  const ticket = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Restore me", status: "In Progress", tags: ["High"] } }),
  );
  await archiveTicketCommand.run(
    ...makeCommandArgs({ storage, params: {}, overrides: { resource: ticketResource(ticket.id) } }),
  );
  return { storage, ticket };
};

describe("unarchive ticket", () => {
  test("restores an archived ticket to the default ticket list", async () => {
    const { storage, ticket } = await seedArchivedTicket();

    await unarchiveTicketCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: ticketResource(ticket.id) } }),
    );

    const listed = await listTicketsCommand.run(...makeCommandArgs({ storage, params: {} }));
    expect(listed.map((row) => row.shorthand)).toEqual([ticket.shorthand]);
    expect(listed[0]).toMatchObject({ status: "In Progress", tags: ["High"] });
  });

  test("keeps the ticket status, tags, sort order, and content and updates the timestamp", async () => {
    const { storage, ticket } = await seedArchivedTicket();
    const archivedAt = "2020-01-01T00:00:00.000Z";
    const archived = { ...(await ticketsCollection(storage).get(ticket.id))!, updatedAt: archivedAt };
    await ticketsCollection(storage).put(ticket.id, archived);

    const result = await unarchiveTicketCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: ticketResource(ticket.id) } }),
    );

    expect(result).toEqual({ ...archived, archived: false, updatedAt: expect.any(String) });
    expect(result?.updatedAt).not.toBe(archivedAt);
    expect(await ticketsCollection(storage).get(ticket.id)).toEqual(result!);
  });

  test("emits the tickets changed event", async () => {
    const { storage, ticket } = await seedArchivedTicket();
    const events: unknown[] = [];

    await unarchiveTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: {},
        overrides: {
          resource: ticketResource(ticket.id),
          events: {
            emit: async (event, payload) => {
              expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({ archived: false });
              events.push({ event, payload });
              return { delivered: 0 };
            },
          },
        },
      }),
    );

    expect(events).toEqual([{ event: plannerTicketsChanged, payload: { ticketId: ticket.id } }]);
  });

  test("returns an active ticket unchanged", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Active" } }));
    const stored = await ticketsCollection(storage).get(ticket.id);

    const result = await unarchiveTicketCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: ticketResource(ticket.id) } }),
    );

    expect(result).toEqual(stored!);
    expect(await ticketsCollection(storage).get(ticket.id)).toEqual(stored!);
  });
});
