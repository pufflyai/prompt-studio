import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { documents } from "../../db/schemas/documents";
import { file_projections } from "../../db/schemas/file-projections";
import { readFileDocumentHead } from "./document-file-persistence";
import { documentFilesFor } from "./document-files";

/** Portable bytes for one committed immutable closure; callers hold the transaction queue. */
export const exportDocumentFiles = async (client: object, projectId: string, row: typeof documents.$inferSelect) => {
  const files = documentFilesFor(client);
  const head = await readFileDocumentHead(files, projectId, row);
  const references: { kind: "head" | "state" | "update" | "operations" | "copy"; sha256: string; bytes: number }[] = [
    { kind: "head" as const, sha256: row.state_sha256, bytes: row.state_bytes },
    { kind: "state" as const, ...head.snapshot },
    ...head.updates.map((update) => ({ kind: "update" as const, ...update })),
    ...(head.operations ? [{ kind: "operations" as const, ...head.operations }] : []),
  ];
  const copies = await (client as Pick<DbClient, "select">)
    .select()
    .from(file_projections)
    .where(and(eq(file_projections.owner_id, row.owner_id), eq(file_projections.document_id, row.id)));
  for (const copy of copies) {
    if (copy.baseline_sha256 !== null && copy.baseline_bytes !== null)
      references.push({ kind: "copy", sha256: copy.baseline_sha256, bytes: copy.baseline_bytes });
    if (copy.pending_sha256 !== null && copy.pending_bytes !== null)
      references.push({ kind: "copy", sha256: copy.pending_sha256, bytes: copy.pending_bytes });
  }
  const output = [];
  for (const { kind, sha256, bytes } of references)
    output.push({
      kind,
      sha256,
      bytes,
      data: `\\x${Buffer.from(await files.read(projectId, row.id, kind, { sha256, bytes })).toString("hex")}`,
    });
  return output;
};
