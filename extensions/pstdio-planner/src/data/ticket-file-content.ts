import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import type { StoredTicketFile } from "./types";

// File bodies live in ticket-scoped blobs, like image attachments. The ticket record keeps only
// the blob id, so a large file never grows the record or the history of every later ticket edit.
const ticketBlobs = (storage: ExtensionStorageApi, ticketId: string) =>
  storage.scope({ type: "resource", resource: { type: "ticket", id: ticketId } }).files;

export const readTicketFileContent = async (storage: ExtensionStorageApi, ticketId: string, file: StoredTicketFile) =>
  new TextDecoder().decode(await ticketBlobs(storage, ticketId).getBytes(file.blobId));

/** Stores a new body and returns its blob id. changeTicketFiles deletes the replaced blob. */
export const storeTicketFileContent = async (
  storage: ExtensionStorageApi,
  ticketId: string,
  name: string,
  content: string,
) => (await ticketBlobs(storage, ticketId).put({ name, data: new TextEncoder().encode(content) })).id;

export const deleteTicketFileContent = (storage: ExtensionStorageApi, ticketId: string, blobIds: string[]) =>
  Promise.all(blobIds.map((id) => ticketBlobs(storage, ticketId).delete(id)));

export const deleteTicketBlobs = async (storage: ExtensionStorageApi, ticketId: string) => {
  const blobs = ticketBlobs(storage, ticketId);
  for (const blob of await blobs.list()) await blobs.delete(blob.id);
};

// Attachments can also point at project uploads, which this ticket does not own. Only blobs in the
// ticket's own scope are deleted.
export const deleteTicketScopedBlobs = async (storage: ExtensionStorageApi, ticketId: string, ids: string[]) => {
  if (!ids.length) return;
  const blobs = ticketBlobs(storage, ticketId);
  for (const blob of await blobs.list()) if (ids.includes(blob.id)) await blobs.delete(blob.id);
};
