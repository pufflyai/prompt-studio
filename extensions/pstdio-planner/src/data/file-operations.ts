import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { ticketsCollection, updateTicket } from "./collections";
import { deleteTicketFileContent, storeTicketFileContent } from "./ticket-file-content";
import { validateTicketFileName } from "./ticket-file-name";
import type { TicketContext } from "./ticket-identity";
import type { StoredTicketFile } from "./types";

const loadTicket = async (ctx: TicketContext, ticketId: string) => {
  const ticket = await ticketsCollection(ctx).get(ticketId);
  if (!ticket) throw new Error(`Unknown ticket: ${ticketId}`);
  return ticket;
};

// Creating from the files tree may run without a prompt, so creation falls back
// to a unique "untitled" name the user can edit later.
const nextUntitledName = (files: StoredTicketFile[]) => {
  const taken = new Set(files.map((file) => file.name));
  if (!taken.has("untitled.md")) return "untitled.md";
  let index = 1;
  while (taken.has(`untitled-${index}.md`)) index += 1;
  return `untitled-${index}.md`;
};

export const createTicketFile = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  ticketId: string;
  name?: string;
}) => {
  const ticket = await loadTicket(input, input.ticketId);
  const now = new Date().toISOString();
  const name = validateTicketFileName(input.name?.trim() || nextUntitledName(ticket.files ?? []));
  const file: StoredTicketFile = {
    id: crypto.randomUUID(),
    name,
    blobId: await storeTicketFileContent(input.storage, ticket.id, name, ""),
    createdAt: now,
    updatedAt: now,
  };
  await updateTicket(input, { ...ticket, files: [...(ticket.files ?? []), file], updatedAt: now });
  return file;
};

export const updateTicketFile = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  ticketId: string;
  fileId: string;
  content?: string;
  name?: string;
}) => {
  if (input.name !== undefined) validateTicketFileName(input.name);
  const ticket = await loadTicket(input, input.ticketId);
  const previous = ticket.files?.find((file) => file.id === input.fileId);
  if (!previous) return null;
  const now = new Date().toISOString();
  const name = input.name ?? previous.name;
  const blobId =
    input.content === undefined
      ? previous.blobId
      : await storeTicketFileContent(input.storage, ticket.id, name, input.content);
  const updated = { ...previous, name, blobId, updatedAt: now };
  const files = (ticket.files ?? []).map((file) => (file.id === input.fileId ? updated : file));
  await updateTicket(input, { ...ticket, files, updatedAt: now });
  if (blobId !== previous.blobId) await deleteTicketFileContent(input.storage, ticket.id, [previous.blobId]);
  return updated;
};

export const deleteTicketFile = async (input: {
  storage: ExtensionStorageApi;
  resources: TicketContext["resources"];
  ticketId: string;
  fileId: string;
}) => {
  const ticket = await loadTicket(input, input.ticketId);
  const removed = (ticket.files ?? []).filter((file) => file.id === input.fileId);
  const files = (ticket.files ?? []).filter((file) => file.id !== input.fileId);
  await updateTicket(input, { ...ticket, files, updatedAt: new Date().toISOString() });
  await deleteTicketFileContent(
    input.storage,
    ticket.id,
    removed.map((file) => file.blobId),
  );
  return { fileId: input.fileId };
};
