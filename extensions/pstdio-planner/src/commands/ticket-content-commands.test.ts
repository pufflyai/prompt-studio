import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketContentCommand } from "./get-ticket-content";
import { saveTicketContentCommand } from "./save-ticket-content";
import { createTicketFileCommand } from "./ticket-files";

const seedContent = async (storage: ReturnType<typeof createMemoryStorage>, ticketId: string, content: string) => {
  const collection = ticketsCollection(storage);
  const ticket = await collection.get(ticketId);
  if (!ticket) throw new Error("ticket missing");
  await collection.put(ticketId, { ...ticket, content });
};

describe("ticket body file-renderer commands", () => {
  test("get-ticket-content resolves the body from params.id", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    await seedContent(storage, ticket.id, "# Title\nbody");

    const result = await getTicketContentCommand.run(...makeCommandArgs({ storage, params: { id: ticket.id } }));

    expect(result).toMatchObject({
      content: "# Title\nbody",
      placeholder: "Write the ticket description…",
      revision: expect.any(String),
    });
  });

  test("get-ticket-content falls back to the bound ticket resource", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    await seedContent(storage, ticket.id, "from resource");

    const result = await getTicketContentCommand.run(
      ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: ticket.id } } }),
    );

    expect(result).toMatchObject({
      content: "from resource",
      placeholder: "Write the ticket description…",
      revision: expect.any(String),
    });
  });

  test("get-ticket-content resolves the document selected on the bound ticket resource", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );
    await ticketsCollection(storage).put(ticket.id, {
      ...(await ticketsCollection(storage).get(ticket.id))!,
      files: [{ ...file, content: "file content" }],
    });

    const result = await getTicketContentCommand.run(
      ...makeCommandArgs({
        storage,
        params: {},
        overrides: { resource: { type: "ticket", id: ticket.id, metadata: { documentId: file.id } } },
      }),
    );

    expect(result).toMatchObject({
      fileName: "notes.md",
      content: "file content",
      placeholder: "Write…",
      revision: expect.any(String),
    });
  });

  test("save-ticket-content persists the body and re-derives the title", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));

    const result = await saveTicketContentCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.id, content: "# Renamed\nrest" } }),
    );

    const stored = await ticketsCollection(storage).get(ticket.id);
    if (!stored) throw new Error("ticket was not stored");
    expect(stored.content).toBe("# Renamed\nrest");
    expect(stored.title).toBe("Renamed");
    expect(result).toEqual({ revision: stored.updatedAt });
  });

  test("save-ticket-content updates the document selected on the bound ticket resource", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );

    await saveTicketContentCommand.run(
      ...makeCommandArgs({
        storage,
        params: { content: "updated file" },
        overrides: { resource: { type: "ticket", id: ticket.id, metadata: { documentId: file.id } } },
      }),
    );

    const stored = await ticketsCollection(storage).get(ticket.id);
    expect(stored?.files?.find((candidate) => candidate.id === file.id)?.content).toBe("updated file");
    expect(stored?.title).toBe("Ticket");
  });
});
