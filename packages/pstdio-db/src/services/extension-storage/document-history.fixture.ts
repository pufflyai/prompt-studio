import type { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type { StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { attachDatabaseAuthority } from "../../db/database-authority";
import * as schema from "../../db/schemas.pg";
import { documents, file_projections, owners } from "../../db/schemas.pg";
import { exportDocumentFiles } from "./document-file-export";
import { insertFileDocument, loadFileDocument, readFileDocumentHead } from "./document-file-persistence";
import {
  createDocumentFiles,
  documentFilesFor,
  trackDocumentFiles,
  withDocumentFileTransaction,
} from "./document-files";
import { localDocumentKey } from "./document-kind";
import { createDocumentStorageDBService } from "./document-storage";
import { externalRoomId, nativeKeyFromId } from "./native-document-files";

type Client = DbClient | Parameters<Parameters<DbClient["transaction"]>[0]>[0];

/** Write fixture data to a stopped, already-migrated home without running candidate migrations. */
export const openClosedDocumentStorage = (engine: PGlite, path: string) => {
  const db = drizzle(engine, { schema });
  attachDatabaseAuthority(db, path);
  documentFilesFor(db, path);
  return createDocumentStorageDBService(db);
};

/** Inspect only an already-migrated, stopped home; never run admission as part of a packaged assertion. */
export const readClosedDocumentText = async (db: PGlite, path: string, owner: StorageOwner, key: string) => {
  const { rows } = await db.query<typeof documents.$inferSelect>(
    "SELECT d.* FROM documents d JOIN owners o ON o.id=d.owner_id WHERE o.project_id=$1 AND o.extension_id=$2 AND d.key=$3",
    [owner.workbenchId, owner.extensionId, key],
  );
  if (rows.length !== 1) throw new Error(`The migrated file document is missing: ${key}`);
  const loaded = await loadFileDocument(createDocumentFiles(`${path}-documents`), owner.workbenchId, rows[0]!);
  try {
    return loaded.document.getText("content").toString();
  } finally {
    loaded.document.destroy();
  }
};
export interface SavedDocumentFixture {
  owner_id: number;
  document_id: string;
  state: Uint8Array;
  revision?: number;
  folded_revision?: number;
  updates?: { revision: number; update: Uint8Array }[];
  operations?: Record<string, string>;
}
/** Populate opaque historical bytes without requiring them to be valid current Yjs updates. */
export const seedDocumentHistory = (client: Client, inputs: SavedDocumentFixture | SavedDocumentFixture[]) =>
  withDocumentFileTransaction(client, async (tx) => {
    for (const input of Array.isArray(inputs) ? inputs : [inputs]) {
      const [owner] = await tx.select().from(owners).where(eq(owners.id, input.owner_id));
      if (!owner) throw new Error("The fixture's document owner is missing");
      await insertFileDocument(tx, documentFilesFor(tx), {
        owner: { workbenchId: owner.project_id, extensionId: owner.extension_id },
        ownerId: owner.id,
        key: input.document_id,
        kind: localDocumentKey(input.document_id) ? "local" : "shared",
        snapshot: input.state,
        revision: input.revision,
        foldedRevision: input.folded_revision,
        updates: input.updates,
        operations: input.operations,
        imported: true,
      });
    }
  });
export const readDocumentHistory = (client: Client) =>
  withDocumentFileTransaction(client, async (tx) => {
    const files = documentFilesFor(tx);
    const saved = await tx
      .select({ row: documents, project: owners.project_id })
      .from(documents)
      .innerJoin(owners, eq(owners.id, documents.owner_id));
    const rows = [],
      updates = [],
      operations = [];
    for (const { row, project } of saved) {
      if (row.kind === "room") continue;
      const head = await readFileDocumentHead(files, project, row);
      const address = { owner_id: row.owner_id, document_id: row.key };
      rows.push({
        ...address,
        state: await files.read(project, row.id, "state", head.snapshot),
        revision: row.revision,
        folded_revision: row.folded_revision,
      });
      for (const update of head.updates)
        updates.push({
          ...address,
          revision: update.revision,
          update: await files.read(project, row.id, "update", update),
        });
      if (head.operations)
        for (const [operation_id, fingerprint] of Object.entries(
          JSON.parse(
            Buffer.from(await files.read(project, row.id, "operations", head.operations)).toString(),
          ) as Record<string, string>,
        ))
          operations.push({ ...address, operation_id, fingerprint });
    }
    return { rows, updates, operations };
  });
/** Device backup fixtures copy the actual file closure alongside their SQL references. */
export const captureDocumentFiles = (client: Client) =>
  withDocumentFileTransaction(client, async (tx) => {
    const rows = await tx
      .select({ row: documents, project: owners.project_id })
      .from(documents)
      .innerJoin(owners, eq(owners.id, documents.owner_id));
    const result = [];
    for (const { row, project } of rows)
      result.push({
        row,
        project,
        files: await exportDocumentFiles(tx, project, row),
        projections: await tx.select().from(file_projections).where(eq(file_projections.document_id, row.id)),
      });
    return result;
  });
const restoreClosure = async (
  files: ReturnType<typeof documentFilesFor>,
  project: string,
  id: number,
  closure: Awaited<ReturnType<typeof exportDocumentFiles>>,
) => {
  for (const file of closure) {
    const reference = await files.put(project, id, file.kind, Buffer.from(file.data.slice(2), "hex"));
    if (reference.sha256 !== file.sha256 || reference.bytes !== file.bytes)
      throw new Error("The document backup fixture is damaged");
  }
};
export const restoreDocumentBackup = (
  client: Client,
  snapshot: Awaited<ReturnType<typeof captureDocumentFiles>>,
  ownerIds?: Map<number, number>,
) =>
  withDocumentFileTransaction(client, async (tx) => {
    const files = documentFilesFor(tx);
    const documentIds = new Map<number, number>();
    const ordered = [...snapshot].sort((a, b) => Number(a.row.kind === "room") - Number(b.row.kind === "room"));
    for (const { row, project, files: closure, projections } of ordered) {
      const ownerId = ownerIds ? ownerIds.get(row.owner_id) : row.owner_id;
      if (ownerId === undefined) throw new Error("The document backup owner is missing");
      const {
        rows: [allocated],
      } = await tx.execute<{ id: string }>(sql`SELECT nextval(pg_get_serial_sequence('documents','id'))::text AS id`);
      const id = Number(allocated!.id);
      trackDocumentFiles(tx, project, id);
      await restoreClosure(files, project, id, closure);
      const roomOf = row.room_of === null ? null : documentIds.get(row.room_of);
      if (roomOf === undefined) throw new Error("The document backup source is missing");
      await tx.insert(documents).values({ ...row, id, owner_id: ownerId, room_of: roomOf });
      documentIds.set(row.id, id);
      for (const copy of projections)
        await tx.insert(file_projections).values({ ...copy, owner_id: ownerId, document_id: id });
    }
  });

export const readNativeRoomHistory = (client: Client) =>
  withDocumentFileTransaction(client, async (tx) => {
    const rows = await tx
      .select({ row: documents, project: owners.project_id })
      .from(documents)
      .innerJoin(owners, eq(owners.id, documents.owner_id));
    const byId = new Map(rows.map((value) => [value.row.id, value.row]));
    const result = [];
    for (const { row, project } of rows)
      if (row.kind === "room") {
        const { document } = await loadFileDocument(documentFilesFor(tx), project, row);
        try {
          result.push({
            id: externalRoomId(row.key),
            document_key: nativeKeyFromId(byId.get(row.room_of!)!.key),
            state: Y.encodeStateAsUpdate(document),
          });
        } finally {
          document.destroy();
        }
      }
    return result;
  });
