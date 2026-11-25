import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import { withDocumentFileBatch } from "../services/extension-storage/document-file-context";
import {
  type FileDocumentInput,
  insertFileDocuments,
  readFileDocumentHead,
} from "../services/extension-storage/document-file-persistence";
import {
  type DocumentFileHead,
  documentFilesFor,
  trackDocumentFiles,
} from "../services/extension-storage/document-files";
import { localDocumentKey } from "../services/extension-storage/document-kind";
import type { DbClient } from "./connection.pglite";
import { documents } from "./schemas/documents";
import { decodeUpgradeBytes } from "./upgrade-bytes";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Input = Record<string, unknown>;
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const position = (value: unknown) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error("Invalid released document position");
  return result;
};
export const restoreDocumentAddresses = async (tx: Transaction, inputs: Input[]) => {
  const addresses = new Map<string, StorageOwner>();
  for (const input of inputs) {
    if (typeof input.workbench_id !== "string" || typeof input.extension_id !== "string")
      throw new Error("Invalid released document owner");
    const owner = { workbenchId: input.workbench_id, extensionId: input.extension_id };
    addresses.set(JSON.stringify([owner.workbenchId, owner.extensionId]), owner);
  }
  const values = JSON.stringify([...addresses.values()]);
  await tx.execute(sql`INSERT INTO owners(project_id,extension_id)
    SELECT "workbenchId","extensionId" FROM jsonb_to_recordset(${values}::jsonb) AS input("workbenchId" text,"extensionId" text)
    ON CONFLICT(project_id,extension_id) DO NOTHING`);
  const { rows } = await tx.execute<{ id: number; project_id: string; extension_id: string }>(sql`
    SELECT o.id,o.project_id,o.extension_id FROM owners o JOIN jsonb_to_recordset(${values}::jsonb)
      AS input("workbenchId" text,"extensionId" text) ON o.project_id=input."workbenchId" AND o.extension_id=input."extensionId"`);
  return new Map(rows.map((row) => [JSON.stringify([row.project_id, row.extension_id]), row.id]));
};

export const documentAddress = (ownerId: number, key: string) => JSON.stringify([ownerId, key]);
export const readDocumentAddresses = async (tx: Transaction, addresses: { owner_id: number; key: string }[]) => {
  const rows = await tx
    .select()
    .from(documents)
    .where(sql`(${documents.owner_id},${documents.key}) IN (
    SELECT owner_id,key FROM jsonb_to_recordset(${JSON.stringify(addresses)}::jsonb) AS input(owner_id bigint,key text))`)
    .for("update");
  return new Map(rows.map((row) => [documentAddress(row.owner_id, row.key), row]));
};

type Files = ReturnType<typeof documentFilesFor>;
type Row = typeof documents.$inferSelect;
const releasedHeader = (owner: StorageOwner, ownerId: number, key: string, input: Input) => {
  const snapshot = decodeUpgradeBytes(input.state);
  const revision = position(input.revision);
  const foldedRevision = position(input.folded_revision);
  const origin = digest(Buffer.from(JSON.stringify([owner, key, revision, foldedRevision, digest(snapshot)])));
  return {
    owner,
    ownerId,
    key,
    kind: localDocumentKey(key) ? "local" : "shared",
    snapshot,
    revision,
    foldedRevision,
    imported: true,
    origin,
  } satisfies FileDocumentInput;
};
const restoreHeaders = async (
  tx: Transaction,
  files: Files,
  inputs: FileDocumentInput[],
  existing: Map<string, Row>,
) => {
  const missing: FileDocumentInput[] = [];
  for (const input of inputs) {
    const row = existing.get(JSON.stringify([input.ownerId, input.key]));
    if (!row) {
      missing.push(input);
      continue;
    }
    const head = await readFileDocumentHead(files, input.owner.workbenchId, row);
    if (head.origin !== input.origin || head.snapshot.sha256 !== digest(input.snapshot))
      throw new Error("Document storage restoration conflict: storage_documents");
    await files.read(input.owner.workbenchId, row.id, "state", head.snapshot);
  }
  await insertFileDocuments(tx, files, missing);
};

const restoreUpdate = async (files: Files, owner: StorageOwner, row: Row, head: DocumentFileHead, input: Input) => {
  const revision = position(input.revision);
  const update = await files.put(owner.workbenchId, row.id, "update", decodeUpgradeBytes(input.update));
  const previous = head.updates.find((entry) => entry.revision === revision);
  if (previous && (previous.sha256 !== update.sha256 || previous.bytes !== update.bytes))
    throw new Error("Document storage restoration conflict: storage_document_updates");
  if (!previous) head.updates.push({ ...update, revision });
  head.updates.sort((first, second) => first.revision - second.revision);
  head.revision = Math.max(head.revision, revision);
};
const restoreRetries = async (files: Files, owner: StorageOwner, row: Row, head: DocumentFileHead, inputs: Input[]) => {
  const saved: Record<string, string> = head.operations
    ? JSON.parse(Buffer.from(await files.read(owner.workbenchId, row.id, "operations", head.operations)).toString())
    : {};
  const known = new Map(Object.entries(saved));
  for (const input of inputs) {
    if (typeof input.operation_id !== "string" || typeof input.fingerprint !== "string")
      throw new Error("Invalid released document retry fact");
    const previous = known.get(input.operation_id);
    if (previous !== undefined && previous !== input.fingerprint)
      throw new Error("Document storage restoration conflict: storage_document_operations");
    known.set(input.operation_id, input.fingerprint);
  }
  head.operations = await files.put(
    owner.workbenchId,
    row.id,
    "operations",
    Buffer.from(JSON.stringify(Object.fromEntries(known))),
  );
};

export const publishRestoredHeads = async (
  tx: Transaction,
  entries: { project: string; row: Row; head: DocumentFileHead }[],
) => {
  const references = await withDocumentFileBatch(
    documentFilesFor(tx),
    entries.map(({ project, row, head }) => async (files) => {
      const reference = await files.writeHead(project, row.id, head);
      return {
        id: row.id,
        revision: head.revision,
        folded_revision: head.foldedRevision,
        state_sha256: reference.sha256,
        state_bytes: reference.bytes,
      };
    }),
  );
  if (references.length)
    await tx.execute(sql`UPDATE documents d SET revision=input.revision,folded_revision=input.folded_revision,
    state_sha256=input.state_sha256,state_bytes=input.state_bytes FROM jsonb_to_recordset(${JSON.stringify(references)}::jsonb)
    AS input(id bigint,revision bigint,folded_revision bigint,state_sha256 text,state_bytes bigint) WHERE d.id=input.id`);
};

/** Restore the released graph straight into immutable files, never another SQL byte table.
 * All inputs stay durable until the entire graph and its archive have completed. */
export const restoreDocumentFileBatch = async (tx: Transaction, table: string, inputs: Input[]) => {
  const files = documentFilesFor(tx);
  const owners = await restoreDocumentAddresses(tx, inputs);
  const addressed = inputs.map((input) => {
    const owner = { workbenchId: String(input.workbench_id), extensionId: String(input.extension_id) };
    const ownerId = owners.get(JSON.stringify([owner.workbenchId, owner.extensionId]));
    if (ownerId === undefined || typeof input.document_id !== "string")
      throw new Error("Invalid released document address");
    return { owner, ownerId, key: input.document_id, input };
  });
  const existing = await readDocumentAddresses(
    tx,
    addressed.map((entry) => ({ owner_id: entry.ownerId, key: entry.key })),
  );
  if (table === "storage_documents")
    return restoreHeaders(
      tx,
      files,
      addressed.map((entry) => releasedHeader(entry.owner, entry.ownerId, entry.key, entry.input)),
      existing,
    );
  const grouped = new Map<string, typeof addressed>();
  for (const entry of addressed) {
    const key = documentAddress(entry.ownerId, entry.key);
    const group = grouped.get(key) ?? [];
    group.push(entry);
    grouped.set(key, group);
  }
  const heads = await withDocumentFileBatch(
    files,
    [...grouped].map(([address, group]) => async (files) => {
      const { owner } = group[0]!;
      const row = existing.get(address);
      if (!row) throw new Error("Released document history has no saved snapshot");
      const head = await readFileDocumentHead(files, owner.workbenchId, row);
      trackDocumentFiles(tx, owner.workbenchId, row.id);
      if (table === "storage_document_updates")
        for (const { input } of group) await restoreUpdate(files, owner, row, head, input);
      else
        await restoreRetries(
          files,
          owner,
          row,
          head,
          group.map(({ input }) => input),
        );
      return { project: owner.workbenchId, row, head };
    }),
  );
  await publishRestoredHeads(tx, heads);
  return heads.map(({ project, row }) => ({ project, id: row.id }));
};
