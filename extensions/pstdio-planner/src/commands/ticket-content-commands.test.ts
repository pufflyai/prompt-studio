import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketContentCommand } from "./get-ticket-content";
import { saveTicketContentCommand } from "./save-ticket-content";

const seedContent = async (storage: ReturnType<typeof createMemoryStorage>, ticketId: string, content: string) => {
  const collection = ticketsCollection(storage);
  const ticket = await collection.get(ticketId);
  if (!ticket) throw new Error("ticket missing");
  await collection.put(ticketId, { ...ticket, content });
};

describe("ticket body file-renderer commands", () => {
  test("get-ticket-content resolves the body from params.id", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    await seedContent(storage, ticket.id, "# Title\nbody");

    const result = await getTicketContentCommand.run(makeCommandContext({ storage, params: { id: ticket.id } }));

    expect(result).toEqual({ content: "# Title\nbody", placeholder: "Write the ticket description…" });
  });

  test("get-ticket-content falls back to the bound ticket resource", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    await seedContent(storage, ticket.id, "from resource");

    const result = await getTicketContentCommand.run(
      makeCommandContext({ storage, params: {}, overrides: { resource: { type: "ticket", id: ticket.id } } }),
    );

    expect(result).toEqual({ content: "from resource", placeholder: "Write the ticket description…" });
  });

  test("save-ticket-content persists the body and re-derives the title", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    await saveTicketContentCommand.run(
      makeCommandContext({ storage, params: { id: ticket.id, content: "# Renamed\nrest" } }),
    );

    const stored = await ticketsCollection(storage).get(ticket.id);
    expect(stored?.content).toBe("# Renamed\nrest");
    expect(stored?.title).toBe("Renamed");
  });
});
