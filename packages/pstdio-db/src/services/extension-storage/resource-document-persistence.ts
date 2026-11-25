import { and, eq, inArray } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { ensureFileDocument, readFileDocumentHead } from "./document-file-persistence";
import { type DocumentFileHead, documentFilesFor, trackDocumentFiles } from "./document-files";
import { storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const resourceDocumentId = (recordId: string) => JSON.stringify(["resource", recordId]);

export const loadResourceDocuments = async (tx: Transaction, owner: StorageOwner, ids: string[]) => {
  const rows = await tx
    .select()
    .from(documents)
    .where(and(eq(documents.owner_id, storageOwnerKey(owner)), inArray(documents.key, ids)));
  const files = documentFilesFor(tx);
  const sources = new Map<
    string,
    { revision: number; folded_revision: number; state: Uint8Array; states: Uint8Array[] }
  >();
  let updates = 0;
  let bytes = 0;
  for (const row of rows) {
    const head = await readFileDocumentHead(files, owner.workbenchId, row);
    const state = await files.read(owner.workbenchId, row.id, "state", head.snapshot);
    const states = [state];
    for (const update of head.updates) states.push(await files.read(owner.workbenchId, row.id, "update", update));
    updates += head.updates.length;
    bytes += states.reduce((sum, value) => sum + value.length, 0);
    sources.set(row.key, { revision: row.revision, folded_revision: row.folded_revision, state, states });
  }
  return { sources, loaded: { documents: rows.length, updates, bytes } };
};

interface ResourceChange {
  id: string;
  revision: number;
  foldedRevision: number;
  checkpoint: Uint8Array | null;
  update: Uint8Array | null;
}

export const persistResourceDocuments = async (tx: Transaction, owner: StorageOwner, prepared: ResourceChange[]) => {
  const files = documentFilesFor(tx);
  for (const change of prepared) {
    if (change.update === null) continue;
    const { row } = await ensureFileDocument(tx, files, { owner, key: change.id, kind: "local" });
    trackDocumentFiles(tx, owner.workbenchId, row.id);
    const previous = await readFileDocumentHead(files, owner.workbenchId, row);
    let head: DocumentFileHead;
    if (change.checkpoint)
      head = {
        format: 1,
        revision: change.revision,
        foldedRevision: change.revision,
        snapshot: await files.put(owner.workbenchId, row.id, "state", change.checkpoint),
        updates: [],
        ...(previous.operations && { operations: previous.operations }),
      };
    else
      head = {
        ...previous,
        revision: change.revision,
        updates: [
          ...previous.updates,
          { ...(await files.put(owner.workbenchId, row.id, "update", change.update)), revision: change.revision },
        ],
      };
    const reference = await files.writeHead(owner.workbenchId, row.id, head);
    await tx
      .update(documents)
      .set({
        revision: head.revision,
        folded_revision: head.foldedRevision,
        state_sha256: reference.sha256,
        state_bytes: reference.bytes,
      })
      .where(eq(documents.id, row.id));
  }
};
