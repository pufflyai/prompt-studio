import { expect, test } from "bun:test";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { saveTicketCommand } from "../commands/save-ticket";
import { writeTicketCommand } from "../commands/write-ticket";
import { TICKETS_DIR, ticketMarkdownPath } from "../data/draft-storage";
import { ticketRenumberedHook } from "./ticket-renumbered";

const setup = async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  const ctx = makeCommandContext({ storage, params: {}, overrides: { projectFiles } });
  const written = await writeTicketCommand.run(ctx, { title: "Local draft" });
  const [ticket] = await storage.collection<{ id: string }>("tickets").list();
  const event = {
    resource: { type: "ticket", id: ticket!.id, extensionId: ctx.extensionId },
    previousShorthand: written.shorthand,
    shorthand: "T-2",
  };
  return { ctx, projectFiles, ticket: ticket!, event };
};

test("core renumbering moves the owned checkout and preserves unsaved text and binary files", async () => {
  const { ctx, projectFiles, ticket, event } = await setup();
  const original = await projectFiles.readText(ticketMarkdownPath("T-1"));
  await projectFiles.writeText(ticketMarkdownPath("T-1"), original.replace("# Local draft", "# Unsaved edit"));
  await projectFiles.writeBytes(`${TICKETS_DIR}/T-1/files/image.png`, new Uint8Array([1, 2, 255]));
  const emitted: unknown[] = [];
  const emit = ctx.events.emit;
  ctx.events.emit = async (event, payload) => {
    emitted.push(payload);
    return emit(event, payload);
  };
  ctx.resources.identity = async () => ({ id: ticket.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] });
  ctx.resources.findByShorthand = async () => [{ id: ticket.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] }];
  await ticketRenumberedHook.run({ ...ctx, eventId: "event", deliveryId: "delivery" }, event);
  expect(await projectFiles.exists(ticketMarkdownPath("T-1"))).toBe(false);
  expect(await projectFiles.readText(ticketMarkdownPath("T-2"))).toContain("# Unsaved edit");
  expect(await projectFiles.readText(ticketMarkdownPath("T-2"))).toContain('ticket_id: "T-2"');
  expect(await projectFiles.readBytes(`${TICKETS_DIR}/T-2/files/image.png`)).toEqual(new Uint8Array([1, 2, 255]));
  expect(emitted).toContainEqual({ ticketId: ticket.id });
  expect(await saveTicketCommand.run(ctx, { id: "T-1" })).toMatchObject({ shorthand: "T-2" });
  expect((await ctx.storage.collection<{ content: string }>("tickets").get(ticket.id))?.content).toContain(
    "Unsaved edit",
  );
});

test("a remote renumber never moves the other ticket's checkout at the shared old number", async () => {
  const { ctx, projectFiles, event } = await setup();
  const second = await createTicketCommand.run(ctx, { title: "Remote" });
  await ticketRenumberedHook.run(
    { ...ctx, eventId: "event", deliveryId: "delivery" },
    { ...event, resource: { ...event.resource, id: second.id } },
  );
  expect(await projectFiles.exists(ticketMarkdownPath("T-1"))).toBe(true);
  expect(await projectFiles.exists(ticketMarkdownPath("T-2"))).toBe(false);
});

test("core renumbering moves a checkout written before checkouts stored the ticket ID", async () => {
  const { ctx, projectFiles, ticket, event } = await setup();
  const original = await projectFiles.readText(ticketMarkdownPath("T-1"));
  await projectFiles.writeText(ticketMarkdownPath("T-1"), original.replace(/^resource_id:.*\n/m, ""));
  ctx.resources.identity = async () => ({ id: ticket.id, kind: "ticket", shorthand: "T-2", aliases: ["T-1"] });
  await ticketRenumberedHook.run({ ...ctx, eventId: "event", deliveryId: "delivery" }, event);
  expect(await projectFiles.exists(ticketMarkdownPath("T-1"))).toBe(false);
  expect(await projectFiles.readText(ticketMarkdownPath("T-2"))).toContain('ticket_id: "T-2"');
});
