import { eq } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import { documents } from "../../db/schemas/documents";
import { ensureFileDocument, fileDocumentWhere, readFileDocumentHead } from "./document-file-persistence";
import { documentFilesFor, trackDocumentFiles, withDocumentFileTransaction } from "./document-files";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const documentRetryFacts = async (client: object, projectId: string, row: typeof documents.$inferSelect) => {
  const files = documentFilesFor(client);
  const head = await readFileDocumentHead(files, projectId, row);
  const known: unknown = head.operations
    ? JSON.parse(Buffer.from(await files.read(projectId, row.id, "operations", head.operations)).toString())
    : {};
  if (
    !known ||
    Array.isArray(known) ||
    typeof known !== "object" ||
    Object.values(known).some((value) => typeof value !== "string")
  )
    throw new Error("Invalid saved document retry facts");
  return known as Record<string, string>;
};

export const readDocumentRetry = (client: object, owner: StorageOwner, key: string, operationId: string) =>
  withDocumentFileTransaction(client, async (tx) => {
    const [row] = await tx.select().from(documents).where(fileDocumentWhere(owner, key));
    if (!row) return undefined;
    return Object.getOwnPropertyDescriptor(await documentRetryFacts(tx, owner.workbenchId, row), operationId)?.value as
      | string
      | undefined;
  });

/** Released retry facts stay until document/owner deletion; ordinary public saves use the ordered journal. */
export const rememberDocumentRetry = async (
  tx: Transaction,
  owner: StorageOwner,
  key: string,
  operationId: string,
  fingerprint: string,
) => {
  const files = documentFilesFor(tx);
  const { row } = await ensureFileDocument(tx, files, { owner, key, kind: "local" });
  const previous = await documentRetryFacts(tx, owner.workbenchId, row);
  const known = Object.getOwnPropertyDescriptor(previous, operationId)?.value;
  if (known !== undefined) {
    if (known !== fingerprint) throw new Error("Operation identity reused with changed payload");
    return;
  }
  const head = await readFileDocumentHead(files, owner.workbenchId, row);
  trackDocumentFiles(tx, owner.workbenchId, row.id);
  head.operations = await files.put(
    owner.workbenchId,
    row.id,
    "operations",
    Buffer.from(JSON.stringify(Object.fromEntries([...Object.entries(previous), [operationId, fingerprint]]))),
  );
  const reference = await files.writeHead(owner.workbenchId, row.id, head);
  await tx
    .update(documents)
    .set({ state_sha256: reference.sha256, state_bytes: reference.bytes })
    .where(eq(documents.id, row.id));
};
