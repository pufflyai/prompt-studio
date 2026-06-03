import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { putTicket, ticketsCollection } from "./collections";
import type { StoredTicketFile } from "./types";

const loadTicket = async (storage: ExtensionStorageApi, ticketId: string) => {
  const ticket = await ticketsCollection(storage).get(ticketId);
  if (!ticket) throw new Error(`Unknown ticket: ${ticketId}`);
  return ticket;
};

export const createTicketFile = async (input: { storage: ExtensionStorageApi; ticketId: string; name: string }) => {
  const ticket = await loadTicket(input.storage, input.ticketId);
  const now = new Date().toISOString();
  const file: StoredTicketFile = {
    id: crypto.randomUUID(),
    name: input.name,
    content: "",
    createdAt: now,
    updatedAt: now,
  };
  await putTicket(input.storage, { ...ticket, files: [...(ticket.files ?? []), file], updatedAt: now });
  return file;
};

export const updateTicketFile = async (input: {
  storage: ExtensionStorageApi;
  ticketId: string;
  fileId: string;
  content?: string;
  name?: string;
}) => {
  const ticket = await loadTicket(input.storage, input.ticketId);
  const now = new Date().toISOString();
  const files = (ticket.files ?? []).map((file) =>
    file.id === input.fileId
      ? {
          ...file,
          ...(input.content !== undefined ? { content: input.content } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          updatedAt: now,
        }
      : file,
  );
  await putTicket(input.storage, { ...ticket, files, updatedAt: now });
  return files.find((file) => file.id === input.fileId) ?? null;
};

export const deleteTicketFile = async (input: { storage: ExtensionStorageApi; ticketId: string; fileId: string }) => {
  const ticket = await loadTicket(input.storage, input.ticketId);
  const files = (ticket.files ?? []).filter((file) => file.id !== input.fileId);
  await putTicket(input.storage, { ...ticket, files, updatedAt: new Date().toISOString() });
  return { fileId: input.fileId };
};
