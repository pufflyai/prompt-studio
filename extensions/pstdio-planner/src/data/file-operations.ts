import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { changeTicketFiles } from "./collections";
import { storeTicketFileContent } from "./ticket-file-content";
import { validateTicketFileName } from "./ticket-file-name";
import type { StoredTicketFile } from "./types";

// Creating from the files tree may run without a prompt, so creation falls back
// to a unique "untitled" name the user can edit later.
const nextUntitledName = (files: StoredTicketFile[]) => {
  const taken = new Set(files.map((file) => file.name));
  if (!taken.has("untitled.md")) return "untitled.md";
  let index = 1;
  while (taken.has(`untitled-${index}.md`)) index += 1;
  return `untitled-${index}.md`;
};

export const createTicketFile = async (input: { storage: ExtensionStorageApi; ticketId: string; name?: string }) => {
  const next = await changeTicketFiles(input.storage, input.ticketId, async (ticket) => {
    const now = new Date().toISOString();
    const name = validateTicketFileName(input.name?.trim() || nextUntitledName(ticket.files ?? []));
    const file: StoredTicketFile = {
      id: crypto.randomUUID(),
      name,
      blobId: await storeTicketFileContent(input.storage, ticket.id, name, ""),
      createdAt: now,
      updatedAt: now,
    };
    return { ...ticket, files: [...(ticket.files ?? []), file], updatedAt: now };
  });
  return next.files!.at(-1)!;
};

// Each change starts from the stored file, so a rename keeps a body saved a moment earlier.
export const updateTicketFile = async (input: {
  storage: ExtensionStorageApi;
  ticketId: string;
  fileId: string;
  content?: string;
  name?: string;
}) => {
  if (input.name !== undefined) validateTicketFileName(input.name);
  const next = await changeTicketFiles(input.storage, input.ticketId, async (ticket) => {
    const previous = ticket.files?.find((file) => file.id === input.fileId);
    if (!previous) return ticket;
    const now = new Date().toISOString();
    const name = input.name ?? previous.name;
    const blobId =
      input.content === undefined
        ? previous.blobId
        : await storeTicketFileContent(input.storage, ticket.id, name, input.content);
    const updated = { ...previous, name, blobId, updatedAt: now };
    const files = (ticket.files ?? []).map((file) => (file.id === input.fileId ? updated : file));
    return { ...ticket, files, updatedAt: now };
  });
  return next.files?.find((file) => file.id === input.fileId) ?? null;
};

export const deleteTicketFile = async (input: { storage: ExtensionStorageApi; ticketId: string; fileId: string }) => {
  await changeTicketFiles(input.storage, input.ticketId, async (ticket) => ({
    ...ticket,
    files: (ticket.files ?? []).filter((file) => file.id !== input.fileId),
    updatedAt: new Date().toISOString(),
  }));
  return { fileId: input.fileId };
};
