import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { eq, inArray, sql } from "drizzle-orm";
import type { NativeTextTarget } from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import { withDocumentFileBatch } from "../services/extension-storage/document-file-context";
import {
  type FileDocumentInput,
  insertFileDocuments,
  readFileDocumentHead,
} from "../services/extension-storage/document-file-persistence";
import { documentFilesFor, trackDocumentFiles } from "../services/extension-storage/document-files";
import { nativeDocumentId, roomDocumentId } from "../services/extension-storage/document-kind";
import type { DbClient } from "./connection.pglite";
import {
  documentAddress,
  publishRestoredHeads,
  readDocumentAddresses,
  restoreDocumentAddresses,
} from "./document-file-upgrade";
import { documents } from "./schemas/documents";
import { file_projections } from "./schemas/file-projections";
import { owners } from "./schemas/owners";
import { decodeUpgradeBytes } from "./upgrade-bytes";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Input = Record<string, unknown>;
const digest = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
const position = (value: unknown) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error("Invalid released editor revision");
  return number;
};
const restoreRoomUpdates = async (tx: Transaction, inputs: Input[]) => {
  const grouped = new Map<string, Input[]>();
  for (const input of inputs) {
    if (typeof input.room_id !== "string") throw new Error("Invalid released editor room address");
    const batch = grouped.get(input.room_id) ?? [];
    batch.push(input);
    grouped.set(input.room_id, batch);
  }
  const files = documentFilesFor(tx);
  const rooms = await tx
    .select({ row: documents, project: owners.project_id })
    .from(documents)
    .innerJoin(owners, eq(owners.id, documents.owner_id))
    .where(inArray(documents.key, [...grouped.keys()].map(roomDocumentId)));
  const heads = await withDocumentFileBatch(
    files,
    [...grouped].map(([id, updates]) => async (files) => {
      const matches = rooms.filter((saved) => saved.row.key === roomDocumentId(id));
      const saved = matches[0];
      if (matches.length !== 1 || saved!.row.kind !== "room")
        throw new Error("Released editor history has no unique room");
      const { row, project } = saved!;
      const head = await readFileDocumentHead(files, project, row);
      trackDocumentFiles(tx, project, row.id);
      for (const input of updates) {
        const revision = position(input.revision);
        const reference = await files.put(project, row.id, "update", decodeUpgradeBytes(input.update));
        const previous = head.updates.find((entry) => entry.revision === revision);
        if (previous && (previous.sha256 !== reference.sha256 || previous.bytes !== reference.bytes))
          throw new Error("Native storage restoration conflict: native_document_room_updates");
        if (!previous) head.updates.push({ ...reference, revision });
        head.revision = Math.max(head.revision, revision);
      }
      head.updates.sort((first, second) => first.revision - second.revision);
      return { project, row, head };
    }),
  );
  await publishRestoredHeads(tx, heads);
};

type Files = ReturnType<typeof documentFilesFor>;
type Row = typeof documents.$inferSelect;
const restoreRoom = async (files: Files, owner: StorageOwner, source: Row, input: Input, existing: Row | undefined) => {
  if (typeof input.id !== "string") throw new Error("Invalid released editor room address");
  const key = roomDocumentId(input.id);
  const snapshot = decodeUpgradeBytes(input.state);
  const revision = position(input.revision);
  const foldedRevision = position(input.folded_revision);
  const origin = digest([owner, input.id, input.document_key, input.state, revision, foldedRevision]);
  if (existing) {
    const head = await readFileDocumentHead(files, owner.workbenchId, existing);
    if (existing.kind !== "room" || existing.room_of !== source.id || head.origin !== origin)
      throw new Error("Native storage restoration conflict: native_document_rooms");
    await files.read(owner.workbenchId, existing.id, "state", head.snapshot);
    return;
  }
  return {
    owner,
    ownerId: source.owner_id,
    key,
    kind: "room",
    roomOf: source.id,
    snapshot,
    revision,
    foldedRevision,
    imported: true,
    origin,
  } satisfies FileDocumentInput;
};
const restoreProjection = async (tx: Transaction, files: Files, owner: StorageOwner, source: Row, input: Input) => {
  if (typeof input.document_key !== "string" || typeof input.projection_key !== "string")
    throw new Error("Invalid released native file copy address");
  const root = JSON.stringify(["native", input.projection_key]);
  const copy = async (value: unknown) =>
    value === null ? null : files.put(owner.workbenchId, source.id, "copy", decodeUpgradeBytes(value));
  trackDocumentFiles(tx, owner.workbenchId, source.id);
  const baseline = await copy(input.baseline);
  const pending = await copy(input.pending);
  const expected = {
    owner_id: source.owner_id,
    root,
    path: input.document_key,
    document_id: source.id,
    state: null,
    baseline_sha256: baseline?.sha256 ?? null,
    baseline_bytes: baseline?.bytes ?? null,
    pending_sha256: pending?.sha256 ?? null,
    pending_bytes: pending?.bytes ?? null,
    completed_revision: position(input.completed_revision),
  };
  return expected;
};
const insertProjections = async (tx: Transaction, inputs: (typeof file_projections.$inferSelect)[]) => {
  if (!inputs.length) return;
  const existing = await tx
    .select()
    .from(file_projections)
    .where(sql`(${file_projections.owner_id},${file_projections.root},${file_projections.path}) IN
    (SELECT owner_id,root,path FROM jsonb_to_recordset(${JSON.stringify(inputs.map((row) => ({ owner_id: row.owner_id, root: row.root, path: row.path })))}::jsonb) AS input(owner_id bigint,root text,path text))`);
  const key = (row: typeof file_projections.$inferSelect) => JSON.stringify([row.owner_id, row.root, row.path]);
  const byKey = new Map(existing.map((row) => [key(row), row]));
  const missing = [];
  for (const row of inputs) {
    const previous = byKey.get(key(row));
    if (!previous) missing.push(row);
    else if (!isDeepStrictEqual(previous, row))
      throw new Error("Native storage restoration conflict: native_document_file_projections");
  }
  if (missing.length) await tx.insert(file_projections).values(missing);
};
const restoreSource = async (
  tx: Transaction,
  owner: StorageOwner,
  ownerId: number,
  key: string,
  input: Input,
  source: Row | undefined,
) => {
  const target = input.target as NativeTextTarget | null;
  if (!source)
    return { owner, ownerId, key, kind: "local", snapshot: new Uint8Array([0, 0]), target } satisfies FileDocumentInput;
  if (source.kind === "room") throw new Error("A private room cannot own another editor room");
  if (source.target !== null && !isDeepStrictEqual(source.target, target))
    throw new Error("Native storage restoration conflict: native_document_sources");
  if (!isDeepStrictEqual(source.target, target))
    await tx.update(documents).set({ target }).where(eq(documents.id, source.id));
};

export const restoreNativeFileBatch = async (tx: Transaction, table: string, inputs: Input[]) => {
  if (table === "native_document_room_updates") return restoreRoomUpdates(tx, inputs);
  const files = documentFilesFor(tx);
  const addresses = await restoreDocumentAddresses(tx, inputs);
  const addressed = inputs.map((input) => {
    if (typeof input.document_key !== "string") throw new Error("Invalid released native document address");
    const owner = { workbenchId: String(input.workbench_id), extensionId: String(input.extension_id) };
    const ownerId = addresses.get(JSON.stringify([owner.workbenchId, owner.extensionId]));
    if (ownerId === undefined) throw new Error("Invalid released native document owner");
    return { owner, ownerId, input, key: nativeDocumentId(input.document_key) };
  });
  const sources = await readDocumentAddresses(
    tx,
    addressed.map((entry) => ({ owner_id: entry.ownerId, key: entry.key })),
  );
  const rooms =
    table === "native_document_rooms"
      ? await readDocumentAddresses(
          tx,
          addressed.map((entry) => {
            if (typeof entry.input.id !== "string") throw new Error("Invalid released editor room address");
            return { owner_id: entry.ownerId, key: roomDocumentId(entry.input.id) };
          }),
        )
      : new Map<string, Row>();
  const missing: FileDocumentInput[] = [];
  if (table === "native_document_file_projections") {
    const projections = await withDocumentFileBatch(
      files,
      addressed.map(({ owner, ownerId, input, key }) => async (files) => {
        const source = sources.get(documentAddress(ownerId, key));
        if (!source || source.kind === "room") throw new Error("Released editor state has no source address");
        return restoreProjection(tx, files, owner, source, input);
      }),
    );
    await insertProjections(tx, projections);
    return;
  }
  for (const { owner, ownerId, input, key } of addressed) {
    const source = sources.get(documentAddress(ownerId, key));
    if (table === "native_document_sources") {
      const value = await restoreSource(tx, owner, ownerId, key, input, source);
      if (value) missing.push(value);
      continue;
    }
    if (!source || source.kind === "room") throw new Error("Released editor state has no source address");
    if (table === "native_document_rooms") {
      const value = await restoreRoom(
        files,
        owner,
        source,
        input,
        rooms.get(documentAddress(ownerId, roomDocumentId(String(input.id)))),
      );
      if (value) missing.push(value);
    }
  }
  await insertFileDocuments(tx, files, missing);
};
