import { eq, ne } from "drizzle-orm";
import { readFileDocumentHead } from "../services/extension-storage/document-file-persistence";
import { documentFilesFor } from "../services/extension-storage/document-files";
import { externalRoomId, nativeKeyFromId } from "../services/extension-storage/native-document-files";
import { recoveryFilesFor } from "../services/extension-storage/recovery-files";
import type { createDb } from "./connection.pglite";
import { documents } from "./schemas/documents";
import { file_projections } from "./schemas/file-projections";
import { owners } from "./schemas/owners";
import { recovery_point_owners } from "./schemas/recovery-points";

type Saved = { document: typeof documents.$inferSelect; project: string; extension: string };
const hex = (bytes: Uint8Array) => `\\x${Buffer.from(bytes).toString("hex")}`;
const appendDocument = async (
  output: Record<string, Record<string, unknown>[]>,
  files: ReturnType<typeof documentFilesFor>,
  value: Saved,
  byId: Map<number, Saved>,
) => {
  const { document: row, project, extension } = value;
  const head = await readFileDocumentHead(files, project, row);
  const state = hex(await files.read(project, row.id, "state", head.snapshot));
  const address = { workbench_id: project, extension_id: extension };
  if (row.kind === "room") {
    const id = externalRoomId(row.key);
    const source = byId.get(row.room_of!)!;
    output.native_document_rooms!.push({
      ...address,
      id,
      document_key: nativeKeyFromId(source.document.key),
      state,
      revision: row.revision,
      folded_revision: row.folded_revision,
    });
    for (const update of head.updates)
      output.native_document_room_updates!.push({
        room_id: id,
        revision: update.revision,
        update: hex(await files.read(project, row.id, "update", update)),
      });
    return;
  }
  output.storage_documents!.push({
    ...address,
    document_id: row.key,
    state,
    revision: row.revision,
    folded_revision: row.folded_revision,
  });
  for (const update of head.updates)
    output.storage_document_updates!.push({
      ...address,
      document_id: row.key,
      revision: update.revision,
      update: hex(await files.read(project, row.id, "update", update)),
    });
  if (head.operations)
    for (const [operation_id, fingerprint] of Object.entries(
      JSON.parse(Buffer.from(await files.read(project, row.id, "operations", head.operations)).toString()),
    ))
      output.storage_document_operations!.push({ ...address, document_id: row.key, operation_id, fingerprint });
  if (row.key.startsWith('["native-markdown",'))
    output.native_document_sources!.push({
      ...address,
      document_key: nativeKeyFromId(row.key),
      target: row.target,
    });
};

/** Reconstruct released input through actual committed file references, not a second runtime store. */
export const releasedDocumentRows = async (connection: Pick<Awaited<ReturnType<typeof createDb>>, "db">) =>
  connection.db.transaction(async (tx) => {
    const output: Record<string, Record<string, unknown>[]> = Object.fromEntries(
      [
        "storage_documents",
        "storage_document_updates",
        "storage_document_operations",
        "native_document_sources",
        "native_document_rooms",
        "native_document_room_updates",
        "native_document_file_projections",
        "artifact_file_projection_roots",
        "artifact_file_projections",
        "recovery_point_owners",
      ].map((name) => [name, []]),
    );
    const rows = await tx
      .select({ document: documents, project: owners.project_id, extension: owners.extension_id })
      .from(documents)
      .innerJoin(owners, eq(owners.id, documents.owner_id));
    const byId = new Map(rows.map((row) => [row.document.id, row]));
    const files = documentFilesFor(tx);
    for (const value of rows) await appendDocument(output, files, value, byId);
    const copies = await tx
      .select({ copy: file_projections, project: owners.project_id, extension: owners.extension_id })
      .from(file_projections)
      .innerJoin(owners, eq(owners.id, file_projections.owner_id));
    const artifactRoots = new Set<string>();
    for (const { copy, project, extension } of copies) {
      const [kind, key] = JSON.parse(copy.root) as string[];
      if (kind === "artifact") {
        if (!artifactRoots.has(key!)) {
          output.artifact_file_projection_roots!.push({ projection_key: key });
          artifactRoots.add(key!);
        }
        if (copy.state !== null)
          output.artifact_file_projections!.push({ projection_key: key, path: copy.path, state: copy.state });
      } else {
        const read = async (sha256: string | null, bytes: number | null) =>
          sha256 === null || bytes === null
            ? null
            : hex(await files.read(project, copy.document_id!, "copy", { sha256, bytes }));
        output.native_document_file_projections!.push({
          workbench_id: project,
          extension_id: extension,
          document_key: copy.path,
          projection_key: key,
          baseline: await read(copy.baseline_sha256, copy.baseline_bytes),
          pending: await read(copy.pending_sha256, copy.pending_bytes),
          completed_revision: copy.completed_revision,
        });
      }
    }
    const recoveries = await tx
      .select({ row: recovery_point_owners, extension: owners.extension_id })
      .from(recovery_point_owners)
      .innerJoin(owners, eq(owners.id, recovery_point_owners.owner_id));
    for (const { row, extension } of recoveries) {
      const content = await recoveryFilesFor(connection.db).read(row.project_id, row.hours, row);
      output.recovery_point_owners!.push({
        workbench_id: row.project_id,
        extension_id: extension,
        hours: row.hours,
        revision: row.revision,
        records: hex(content.records),
        metadata: hex(content.metadata),
      });
    }
    return output;
  });

export const countDocumentUpdates = async (db: Awaited<ReturnType<typeof createDb>>["db"], rooms: boolean) =>
  db.transaction(async (tx) => {
    const rows = await tx
      .select({ row: documents, project: owners.project_id })
      .from(documents)
      .innerJoin(owners, eq(owners.id, documents.owner_id))
      .where(rooms ? eq(documents.kind, "room") : ne(documents.kind, "room"));
    let count = 0;
    for (const { row, project } of rows)
      count += (await readFileDocumentHead(documentFilesFor(tx), project, row)).updates.length;
    return count;
  });
