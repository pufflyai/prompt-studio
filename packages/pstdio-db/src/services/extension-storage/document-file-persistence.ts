import { and, eq, sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { withDocumentFileBatch } from "./document-file-context";
import { type DocumentFileHead, documentFilesFor, trackDocumentFiles } from "./document-files";
import { ensureStorageOwner, storageOwnerKey } from "./storage-owner-key";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Files = ReturnType<typeof documentFilesFor>;
type Row = typeof documents.$inferSelect;
export const fileDocumentWhere = (owner: StorageOwner, key: string) =>
  and(eq(documents.owner_id, storageOwnerKey(owner)), eq(documents.key, key));

export const readFileDocumentHead = async (files: Files, projectId: string, row: Row) => {
  const head = await files.head(projectId, row.id, { sha256: row.state_sha256, bytes: row.state_bytes });
  if (head.revision !== row.revision || head.foldedRevision !== row.folded_revision)
    throw new Error("The saved document history does not match its committed revision");
  return head;
};

export const loadFileDocument = async (files: Files, projectId: string, row: Row) => {
  const head = await readFileDocumentHead(files, projectId, row);
  const snapshot = await files.read(projectId, row.id, "state", head.snapshot);
  const document = new Y.Doc();
  let bytes = snapshot.length;
  try {
    Y.applyUpdate(document, snapshot);
    for (const reference of head.updates) {
      const update = await files.read(projectId, row.id, "update", reference);
      bytes += update.length;
      Y.applyUpdate(document, update);
    }
    return { document, bytes };
  } catch (error) {
    document.destroy();
    throw error;
  }
};

export const readFileDocumentState = async (files: Files, projectId: string, row: Row) => {
  const head = await readFileDocumentHead(files, projectId, row);
  if (head.updates.length) throw new Error("A local marker cannot contain document updates");
  return files.read(projectId, row.id, "state", head.snapshot);
};

export const saveFileDocumentState = async (tx: Transaction, owner: StorageOwner, key: string, state: Uint8Array) => {
  const files = documentFilesFor(tx);
  const { row } = await ensureFileDocument(tx, files, { owner, key, kind: "local" });
  trackDocumentFiles(tx, owner.workbenchId, row.id);
  const revision = row.revision + 1;
  if (!Number.isSafeInteger(revision)) throw new Error("Document revision space is exhausted");
  const snapshot = await files.put(owner.workbenchId, row.id, "state", state);
  const previous = await readFileDocumentHead(files, owner.workbenchId, row);
  const head = await files.writeHead(owner.workbenchId, row.id, {
    format: 1,
    revision,
    foldedRevision: revision,
    snapshot,
    updates: [],
    ...(previous.operations && { operations: previous.operations }),
  });
  await tx
    .update(documents)
    .set({ revision, folded_revision: revision, state_sha256: head.sha256, state_bytes: head.bytes })
    .where(eq(documents.id, row.id));
  return row.id;
};

/** Allocate the immutable file address before publishing any required SQL references. */
export const ensureFileDocument = async (
  tx: Transaction,
  files: Files,
  input: { owner: StorageOwner; key: string; kind: "shared" | "local" },
) => {
  if (input.key.startsWith('["editor-room",'))
    throw new Error("Private editor rooms cannot be opened as shared documents");
  const [existing] = await tx.select().from(documents).where(fileDocumentWhere(input.owner, input.key)).for("update");
  if (existing) {
    if (existing.kind === "room") throw new Error("A private editor room cannot be opened as a shared document");
    if (existing.kind === "local" && input.kind === "shared" && input.key.startsWith('["native-markdown",')) {
      await tx.update(documents).set({ kind: "shared" }).where(eq(documents.id, existing.id));
      existing.kind = "shared";
    }
    return { row: existing, initialize: false };
  }
  const ownerId = await ensureStorageOwner(tx, input.owner);
  return {
    row: await insertFileDocument(tx, files, { ...input, ownerId, snapshot: new Uint8Array([0, 0]) }),
    initialize: true,
  };
};

export type FileDocumentInput = {
  owner: StorageOwner;
  ownerId: number;
  key: string;
  kind: Row["kind"];
  roomOf?: number;
  snapshot: Uint8Array;
  revision?: number;
  foldedRevision?: number;
  updates?: { revision: number; update: Uint8Array }[];
  operations?: Record<string, string>;
  imported?: true;
  origin?: string;
  target?: Row["target"];
};
const prepareFileDocument = async (tx: Transaction, files: Files, input: FileDocumentInput, id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Document identity space is exhausted");
  trackDocumentFiles(tx, input.owner.workbenchId, id);
  const projectId = input.owner.workbenchId;
  const snapshot = await files.put(projectId, id, "state", input.snapshot);
  const updates = [];
  for (const update of input.updates ?? [])
    updates.push({ ...(await files.put(projectId, id, "update", update.update)), revision: update.revision });
  const operations =
    input.operations && Object.keys(input.operations).length
      ? await files.put(projectId, id, "operations", Buffer.from(JSON.stringify(input.operations)))
      : undefined;
  const revision = input.revision ?? 0;
  const foldedRevision = input.foldedRevision ?? 0;
  const head = await files.writeHead(input.owner.workbenchId, id, {
    format: 1,
    revision,
    foldedRevision,
    snapshot,
    updates,
    ...(operations && { operations }),
    ...(input.imported && { imported: input.imported }),
    ...(input.origin && { origin: input.origin }),
  });
  return {
    id,
    owner_id: input.ownerId,
    key: input.key,
    kind: input.kind,
    room_of: input.roomOf,
    target: input.target,
    revision,
    folded_revision: foldedRevision,
    state_sha256: head.sha256,
    state_bytes: head.bytes,
  };
};
/** Allocate and publish one bounded restore batch without per-document SQL round trips. */
export const insertFileDocuments = async (tx: Transaction, files: Files, inputs: FileDocumentInput[]) => {
  if (!inputs.length) return [];
  const { rows: allocated } = await tx.execute<{ id: string }>(
    sql`SELECT nextval(pg_get_serial_sequence('documents','id'))::text AS id FROM generate_series(1,${inputs.length})`,
  );
  const values = await withDocumentFileBatch(
    files,
    inputs.map((input, index) => (writer) => prepareFileDocument(tx, writer, input, Number(allocated[index]!.id))),
  );
  return tx.insert(documents).values(values).returning();
};
export const insertFileDocument = async (tx: Transaction, files: Files, input: FileDocumentInput) => {
  const [row] = await insertFileDocuments(tx, files, [input]);
  return row!;
};

export const saveFileDocument = async (
  tx: Transaction,
  files: Files,
  input: {
    projectId: string;
    row: Row;
    document: Y.Doc;
    updates: Uint8Array[];
    replace?: boolean;
    operations?: Record<string, string>;
  },
) => {
  const { projectId, row, document, updates, replace } = input;
  if (!replace && !updates.length && input.operations === undefined) return row.revision;
  trackDocumentFiles(tx, projectId, row.id);
  const changed = !!replace || updates.length > 0;
  const revision = row.revision + Number(changed);
  if (!Number.isSafeInteger(revision)) throw new Error("Document revision space is exhausted");
  const previous = await readFileDocumentHead(files, projectId, row);
  const fold = replace || previous.imported || revision - row.folded_revision >= 128;
  let head: DocumentFileHead;
  if (fold) {
    head = {
      format: 1,
      revision,
      foldedRevision: revision,
      snapshot: await files.put(projectId, row.id, "state", Y.encodeStateAsUpdate(document)),
      updates: [],
      ...(previous.operations && { operations: previous.operations }),
    };
  } else {
    head = previous;
    if (updates.length) {
      const update = await files.put(projectId, row.id, "update", Y.mergeUpdates(updates));
      head = { ...previous, revision, updates: [...previous.updates, { ...update, revision }] };
    }
  }
  // Released local retry facts leave with their document/owner. Active public records
  // use the ordered journal; this file preserves the legacy adapter's retry contract.
  if (input.operations !== undefined)
    head.operations = await files.put(projectId, row.id, "operations", Buffer.from(JSON.stringify(input.operations)));
  const reference = await files.writeHead(projectId, row.id, head);
  await tx
    .update(documents)
    .set({
      revision,
      folded_revision: head.foldedRevision,
      state_sha256: reference.sha256,
      state_bytes: reference.bytes,
    })
    .where(eq(documents.id, row.id));
  return revision;
};
