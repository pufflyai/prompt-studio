import { type DocumentState, documentHistory, type StorageOwner } from "pstdio-sync";
import type * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import type { documents } from "../../db/schemas/documents";
import { dataMigrationContext } from "./data-migration-context";
import type { LoadedDocument } from "./document-cache";
import {
  ensureFileDocument,
  loadFileDocument,
  readFileDocumentHead,
  saveFileDocument,
} from "./document-file-persistence";
import { documentFilesFor } from "./document-files";
import { localDocumentKey } from "./document-kind";
import type { StorageDiagnostics } from "./storage-diagnostics";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
type Files = ReturnType<typeof documentFilesFor>;
type Row = typeof documents.$inferSelect;
export interface DocumentAddress {
  workbench_id: string;
  extension_id: string;
  document_id: string;
}
const loadDocument = async (
  tx: Transaction,
  files: Files,
  address: DocumentAddress,
  owner: StorageOwner,
  cached?: LoadedDocument,
  diagnostics?: StorageDiagnostics,
) => {
  const { row, initialize } = await ensureFileDocument(tx, files, {
    owner,
    key: address.document_id,
    kind: localDocumentKey(address.document_id) ? "local" : "shared",
  });
  if (cached?.ownerId === row.owner_id && cached.revision === row.revision) return { row, document: cached.document };
  const { document, bytes } = await loadFileDocument(files, owner.workbenchId, row);
  diagnostics?.({ phase: "document-loaded", owner, bytes });
  return { row, document, initialize };
};
const localOperations = (files: Files, projectId: string, row: Row) => {
  let known: Record<string, string> | undefined;
  let changed = false;
  const load = async () => {
    if (known) return known;
    const head = await readFileDocumentHead(files, projectId, row);
    known = head.operations
      ? JSON.parse(Buffer.from(await files.read(projectId, row.id, "operations", head.operations)).toString())
      : {};
    if (
      !known ||
      Array.isArray(known) ||
      typeof known !== "object" ||
      Object.values(known).some((value) => typeof value !== "string")
    )
      throw new Error("Invalid saved document retry facts");
    return known;
  };
  const pending = new Map<string, string>();
  return {
    operation: async (id: string) =>
      pending.get(id) ?? (Object.getOwnPropertyDescriptor(await load(), id)?.value as string | undefined),
    remember(id: string, fingerprint: string) {
      pending.set(id, fingerprint);
      changed = true;
    },
    async saved() {
      if (!changed) return undefined;
      return Object.fromEntries([...pending, ...Object.entries(await load())]);
    },
  };
};

export const runDocumentTransaction = async <T>(
  tx: Transaction,
  input: {
    address: DocumentAddress;
    owner: StorageOwner;
    cached?: LoadedDocument;
    diagnostics?: StorageDiagnostics;
    prepare?: (document: Y.Doc) => Promise<Y.Doc>;
  },
  action: (state: DocumentState) => Promise<T>,
) => {
  const { address } = input;
  const files = documentFilesFor(tx);
  const { document: previous, row } = await loadDocument(
    tx,
    files,
    address,
    input.owner,
    input.cached,
    input.diagnostics,
  );
  let document = previous;
  const operations = localOperations(files, input.owner.workbenchId, row);
  const key = JSON.stringify(address);
  const migration = dataMigrationContext.getStore();
  if (migration && !migration.histories.has(key)) migration.histories.set(key, documentHistory(document));
  const updates: Uint8Array[] = [];
  const capture = (update: Uint8Array) => updates.push(update);
  document.on("update", capture);
  try {
    if (input.prepare) {
      const prepared = await input.prepare(document);
      if (prepared !== document) {
        document.off("update", capture);
        document = prepared;
        document.on("update", capture);
      }
    }
    const value = await action({
      document,
      revision: row.revision,
      migrationSeed: migration?.key,
      migrationHistory: migration?.histories.get(key),
      operation: operations.operation,
      remember: operations.remember,
    });
    const replaced = document !== previous;
    const revision = await saveFileDocument(tx, files, {
      projectId: input.owner.workbenchId,
      row,
      document,
      updates,
      replace: replaced,
      operations: await operations.saved(),
    });
    return { value, revision, document, ownerId: row.owner_id, changed: replaced || updates.length > 0 };
  } catch (error) {
    if (document !== input.cached?.document) document.destroy();
    throw error;
  } finally {
    document.off("update", capture);
    if (document !== previous && previous !== input.cached?.document) previous.destroy();
  }
};
