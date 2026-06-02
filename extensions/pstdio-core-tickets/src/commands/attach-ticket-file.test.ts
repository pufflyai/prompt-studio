import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { attachTicketFileCommand, detachTicketFileCommand } from "./attach-ticket-file";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

const attachment = {
  id: "file-1",
  name: "diagram.png",
  mimeType: "image/png",
  size: 512,
  hash: "sha256",
  url: "/v1/projects/proj-1/extensions/files/file-1/content",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ticket file attachment commands", () => {
  test("attaches a blob ref to a ticket", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const updated = await attachTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, ref: attachment } }),
    );

    expect(updated?.attachments).toEqual([attachment]);
    const persisted = await ticketsCollection(storage).get(ticket.id);
    expect(persisted?.attachments).toEqual([attachment]);
  });

  test("detaches a blob ref from a ticket", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Ticket", attachments: [attachment] } }),
    );

    const updated = await detachTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, fileId: attachment.id } }),
    );

    expect(updated?.attachments).toEqual([]);
  });
});
