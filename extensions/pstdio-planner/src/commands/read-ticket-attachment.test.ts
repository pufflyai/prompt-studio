import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicketAttachment } from "../data/types";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { readTicketAttachmentCommand } from "./read-ticket-attachment";

const attachUpload = async (
  storage: ReturnType<typeof createMemoryStorage>,
  ticketId: string,
  input: { name: string; data: Uint8Array; mimeType: string },
) => {
  const ref = await storage.files.put(input);
  const collection = ticketsCollection(storage);
  const ticket = await collection.get(ticketId);
  if (!ticket) throw new Error("ticket missing");
  const attachment: StoredTicketAttachment = { ...ref, hash: ref.hash ?? "" };
  await collection.put(ticketId, { ...ticket, attachments: [attachment] });
  return ref;
};

describe("read ticket attachment command", () => {
  test("returns a data url built from the stored bytes", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const ref = await attachUpload(storage, ticket.id, { name: "diagram.png", data: bytes, mimeType: "image/png" });

    const result = await readTicketAttachmentCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, attachmentId: ref.id } }),
    );

    const expected = `data:image/png;base64,${btoa(String.fromCharCode(1, 2, 3, 4))}`;
    expect(result).toEqual({ dataUrl: expected });
  });

  test("returns null when the attachment is unknown", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const result = await readTicketAttachmentCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, attachmentId: "missing" } }),
    );

    expect(result).toBeNull();
  });
});
