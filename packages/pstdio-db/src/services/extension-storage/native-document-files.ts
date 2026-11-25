import { eq } from "drizzle-orm";
import type { NativeTextTarget } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { ensureFileDocument, insertFileDocument } from "./document-file-persistence";
import { documentFilesFor } from "./document-files";
import { nativeDocumentId, roomDocumentId } from "./document-kind";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const ensureNativeSource = async (
  tx: Transaction,
  owner: StorageOwner,
  key: string,
  target?: NativeTextTarget | null,
) => {
  // A source address can exist solely to own private rooms/file intents. It enters
  // shared discovery only when its public CRDT is opened through the document writer.
  const { row } = await ensureFileDocument(tx, documentFilesFor(tx), {
    owner,
    key: nativeDocumentId(key),
    kind: "local",
  });
  if (target) await tx.update(documents).set({ target }).where(eq(documents.id, row.id));
  return row;
};

export const insertNativeRoom = async (
  tx: Transaction,
  input: { owner: StorageOwner; documentKey: string; id: string; state: Uint8Array; target?: NativeTextTarget | null },
) => {
  const source = await ensureNativeSource(tx, input.owner, input.documentKey, input.target);
  return insertFileDocument(tx, documentFilesFor(tx), {
    owner: input.owner,
    ownerId: source.owner_id,
    key: roomDocumentId(input.id),
    kind: "room",
    roomOf: source.id,
    snapshot: input.state,
  });
};

export const externalRoomId = (key: string) => (JSON.parse(key) as [string, string])[1];
export const nativeKeyFromId = (key: string) => (JSON.parse(key) as [string, string])[1];
