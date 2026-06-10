import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicketAttachment } from "../data/types";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketFileCommand } from "./get-ticket-file";
import { saveTicketFileCommand } from "./save-ticket-file";
import { createTicketFileCommand, updateTicketFileCommand } from "./ticket-files";

const createTicket = (storage: ReturnType<typeof createMemoryStorage>) =>
  createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

describe("ticket file-renderer commands", () => {
  test("get-ticket-file returns a text file's content from the composite id", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicket(storage);
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "doc.ts" } }),
    );
    await updateTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, fileId: file.id, content: "export const x = 1;" } }),
    );

    const result = await getTicketFileCommand.run(
      makeCommandContext({ storage, params: { id: `${ticket.id}/${file.id}` } }),
    );

    expect(result).toEqual({ fileName: "doc.ts", content: "export const x = 1;" });
  });

  test("get-ticket-file returns an image attachment as a data url", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicket(storage);
    const ref = await storage.files.put({
      name: "diagram.png",
      data: new Uint8Array([1, 2, 3, 4]),
      mimeType: "image/png",
    });
    const collection = ticketsCollection(storage);
    const stored = await collection.get(ticket.id);
    if (!stored) throw new Error("ticket missing");
    const attachment: StoredTicketAttachment = { ...ref, hash: ref.hash ?? "" };
    await collection.put(ticket.id, { ...stored, attachments: [attachment] });

    const result = await getTicketFileCommand.run(
      makeCommandContext({ storage, params: { id: `${ticket.id}/${ref.id}` } }),
    );

    expect(result).toEqual({
      fileName: "diagram.png",
      mimeType: "image/png",
      dataUrl: `data:image/png;base64,${btoa(String.fromCharCode(1, 2, 3, 4))}`,
    });
  });

  test("save-ticket-file writes via the bound ticket-file resource id", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicket(storage);
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "doc.md" } }),
    );

    await saveTicketFileCommand.run(
      makeCommandContext({
        storage,
        params: { content: "updated body" },
        overrides: { resource: { type: "ticket-file", id: `${ticket.id}/${file.id}` } },
      }),
    );

    const result = await getTicketFileCommand.run(
      makeCommandContext({ storage, params: { id: `${ticket.id}/${file.id}` } }),
    );
    expect(result).toEqual({ fileName: "doc.md", content: "updated body" });
  });
});
