import { and, eq, inArray, or } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { file_projections } from "../../db/schemas/file-projections";
import { owners } from "../../db/schemas/owners";
import { readFileDocumentHead } from "./document-file-persistence";
import { documentFilesFor } from "./document-files";

type Files = ReturnType<typeof documentFilesFor>;
type Reference = { kind: Parameters<Files["read"]>[2]; sha256: string; bytes: number };
const copyReferences = (copy: typeof file_projections.$inferSelect) => {
  const references: Reference[] = [];
  if (copy.baseline_sha256 !== null && copy.baseline_bytes !== null)
    references.push({ kind: "copy", sha256: copy.baseline_sha256, bytes: copy.baseline_bytes });
  if (copy.pending_sha256 !== null && copy.pending_bytes !== null)
    references.push({ kind: "copy", sha256: copy.pending_sha256, bytes: copy.pending_bytes });
  return references;
};
const documentReferences = async (files: Files, project: string, row: typeof documents.$inferSelect) => {
  const head = await readFileDocumentHead(files, project, row);
  const references: Reference[] = [
    { kind: "head", sha256: row.state_sha256, bytes: row.state_bytes },
    { kind: "state", ...head.snapshot },
    ...head.updates.map((update) => ({ kind: "update" as const, ...update })),
  ];
  if (head.operations) references.push({ kind: "operations", ...head.operations });
  return references;
};
const pruneFolder = async (files: Files, project: string, id: number, references: Reference[] | null | undefined) => {
  if (references === null) return;
  const names = new Set(references?.map((reference) => files.name(reference.kind, reference)));
  // Read payloads only if collection would remove an older generation. A damaged
  // committed closure keeps the whole folder, including possible recovery copies.
  if (references)
    for await (const name of files.names(project, id))
      if (!names.has(name)) {
        try {
          for (const reference of references) await files.read(project, id, reference.kind, reference);
        } catch {
          return;
        }
        break;
      }
  await files.retainDocument(project, id, names);
};
const visitDocuments = async <T>(values: T[], visit: (value: T) => Promise<void>) => {
  for (let offset = 0; offset < values.length; offset += 8) {
    // A filesystem failure must not release the SQL queue while sibling collectors
    // can still delete files. Remaining, unstarted folders resume at next startup.
    const results = await Promise.allSettled(values.slice(offset, offset + 8).map(visit));
    const failure = results.find((result) => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
};
/** Read committed references and collect while holding the database transaction queue.
 * Unreadable heads retain the entire document folder: it may hold the only saved copy. */
export const pruneDocumentFiles = async (db: DbClient, projectId: string, ids: number[]) => {
  if (!ids.length) return;
  const files = documentFilesFor(db);
  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ document: documents })
      .from(documents)
      .innerJoin(owners, eq(owners.id, documents.owner_id))
      .where(and(eq(owners.project_id, projectId), inArray(documents.id, ids)));
    const retained = new Map<number, Reference[] | null>();
    await visitDocuments(rows, async ({ document }) => {
      try {
        retained.set(document.id, await documentReferences(files, projectId, document));
      } catch {
        retained.set(document.id, null);
      }
    });
    const copies = rows.length
      ? await tx
          .select()
          .from(file_projections)
          .where(
            or(
              ...rows.map(({ document }) =>
                and(eq(file_projections.owner_id, document.owner_id), eq(file_projections.document_id, document.id)),
              ),
            ),
          )
      : [];
    for (const copy of copies) retained.get(copy.document_id!)?.push(...copyReferences(copy));
    await visitDocuments(ids, (id) => pruneFolder(files, projectId, id, retained.get(id)));
  });
};

/** Startup and owner/project deletion remove unreachable files in bounded batches. */
export async function* collectDocumentFiles(db: DbClient, project?: string, batchSize = 200) {
  const files = documentFilesFor(db);
  const projects = project === undefined ? files.projects() : [project];
  for await (const projectId of projects) {
    let batch: number[] = [];
    for await (const id of files.documents(projectId)) {
      batch.push(id);
      if (batch.length === batchSize) {
        await pruneDocumentFiles(db, projectId, batch);
        batch = [];
        yield;
      }
    }
    if (batch.length) {
      await pruneDocumentFiles(db, projectId, batch);
      yield;
    }
  }
}

export const pruneAllDocumentFiles = async (db: DbClient, project?: string) => {
  for await (const _ of collectDocumentFiles(db, project)) {
    /* drain all batches */
  }
};
