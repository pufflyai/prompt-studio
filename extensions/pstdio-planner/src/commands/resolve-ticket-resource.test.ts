import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { resolveTicketResourceCommand } from "./resolve-ticket-resource";

const seedTicket = async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  await seedDefaultTags(storage);
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Draft title" } }));
  return { storage, ticket };
};

describe("resolve ticket resource", () => {
  test("returns the ticket's current title and archived state and keeps the selected document", async () => {
    const { storage, ticket } = await seedTicket();
    const resource = { type: "ticket", id: ticket.id, label: "Old title", metadata: { documentId: "notes.md" } };
    await archiveTicketCommand.run(...makeCommandArgs({ storage, params: {}, overrides: { resource } }));
    await ticketsCollection(storage).put(ticket.id, {
      ...(await ticketsCollection(storage).get(ticket.id))!,
      title: "Renamed",
    });

    const resolved = await resolveTicketResourceCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource } }),
    );

    expect(resolved).toMatchObject({
      type: "ticket",
      id: ticket.id,
      shorthand: ticket.shorthand,
      label: `${ticket.shorthand} Renamed`,
      metadata: { archived: true, documentId: "notes.md" },
    });
  });

  test("returns null when the ticket no longer exists", async () => {
    const { storage } = await seedTicket();

    const resolved = await resolveTicketResourceCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: "gone" } } }),
    );

    expect(resolved).toBeNull();
  });
});
