import { and, eq } from "drizzle-orm";
import { syncDocuments, syncStates, syncUpdates } from "./document-schema";

/** One document. Its ID is random; a null space owner marks the project's shared space. */
export interface DocumentAddress {
  projectId: string;
  spaceOwner: string | null;
  documentId: string;
}

export const documentWhere = (address: DocumentAddress) =>
  and(eq(syncDocuments.projectId, address.projectId), eq(syncDocuments.documentId, address.documentId));
export const updateWhere = (address: DocumentAddress) =>
  and(eq(syncUpdates.projectId, address.projectId), eq(syncUpdates.documentId, address.documentId));
export const stateWhere = (address: DocumentAddress, stateId: string) =>
  and(
    eq(syncStates.projectId, address.projectId),
    eq(syncStates.documentId, address.documentId),
    eq(syncStates.stateId, stateId),
  );
