import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import extension from "../extension";
import { makeCommandArgs, makeCommandContext } from "./commands/command-context.fixture";
import { createTicketCommand } from "./commands/create-ticket";
import { createTicketFileCommand } from "./commands/ticket-files";
import { deleteTicketFile, updateTicketFile } from "./data/file-operations";
import { ticketContext, ticketsCollection } from "./data/ticket-context.fixture";

const provider = () => {
  const source = extension.textSources?.find(({ id }) => id === "ticket-document");
  expect(source).toBeDefined();
  return source!;
};
const fixture = async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Initial" } }));
  const ctx = makeCommandContext({ storage, params: {} });
  return { storage, ticket, ctx };
};

test("Planner selects a public body source and projects its derived title and change event", async () => {
  const { storage, ticket, ctx } = await fixture();
  const events: unknown[] = [];
  const emit = ctx.events.emit;
  ctx.events.emit = async (...event) => {
    events.push(event);
    return emit(...event);
  };
  const editor = extension.views?.find(({ id }) => id === "ticket-editor");
  if (editor?.body.kind !== "file") throw new Error("Missing ticket file view");
  const resource = { type: "ticket", id: ticket.id };
  const loaded = await editor.body.load(ctx, { renderer: { rendererId: editor.id, resource } });
  expect(loaded).toMatchObject({
    textDocument: { sourceId: "ticket-document", params: { ticketId: ticket.id, documentId: "__ticket__" } },
  });
  const source = provider();
  const params = { ticketId: ticket.id, documentId: "__ticket__" };
  expect(await source.resolve(ctx, { params })).toMatchObject({
    source: { kind: "collection", collection: "tickets", id: ticket.id, field: "/content" },
    editable: true,
  });
  await source.project(ctx, { params, content: "# Shared title\n\nShared body" });
  expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({
    title: "Shared title",
    content: "# Shared title\n\nShared body",
  });
  expect(events).toHaveLength(1);
});

test("Planner file sources keep their address through edits and rename and reject missing or foreign selections", async () => {
  const { storage, ticket, ctx } = await fixture();
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
  );
  const source = provider();
  const params = { ticketId: ticket.id, documentId: file.id };
  const initial = await source.resolve(ctx, { params });
  expect(initial.source).toEqual({ kind: "blob", id: file.blobId, identity: JSON.stringify([ticket.id, file.id]) });
  await source.project(ctx, { params, content: "Edited public file" });
  await updateTicketFile({ ...ticketContext(storage), ticketId: ticket.id, fileId: file.id, name: "renamed.md" });
  expect(await source.resolve(ctx, { params })).toMatchObject({
    source: initial.source,
    content: "Edited public file",
  });
  const other = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Other" } }));
  await expect(source.resolve(ctx, { params: { ...params, ticketId: other.id } })).rejects.toThrow(
    "Document unavailable",
  );
  await deleteTicketFile({ ...ticketContext(storage), ticketId: ticket.id, fileId: file.id });
  await expect(source.project(ctx, { params, content: "Recreated?" })).rejects.toThrow("Document unavailable");
  expect(await ticketsCollection(storage).get(ticket.id)).toMatchObject({ content: ticket.content, files: [] });
});

test("ticket code files keep their existing ordinary editor save path", async () => {
  const { storage, ticket, ctx } = await fixture();
  const file = await createTicketFileCommand.run(
    ...makeCommandArgs({ storage, params: { ticketId: ticket.id, name: "settings.json" } }),
  );
  const editor = extension.views?.find(({ id }) => id === "ticket-editor");
  if (editor?.body.kind !== "file") throw new Error("Missing ticket file view");
  const renderer = {
    rendererId: editor.id,
    resource: { type: "ticket", id: ticket.id, metadata: { documentId: file.id } },
  };
  expect(await editor.body.load(ctx, { renderer })).toMatchObject({ fileName: "settings.json", content: "" });
  expect(editor.body.save).toBeDefined();
  await editor.body.save!(ctx, { renderer, content: '{"enabled":true}' });
  expect(await provider().resolve(ctx, { params: { ticketId: ticket.id, documentId: file.id } })).toMatchObject({
    content: '{"enabled":true}',
  });
});
