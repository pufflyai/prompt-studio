import {
  prepareRecordTextEdit,
  readNativeRecordSources,
  readTextDocumentSeed,
  type StorageOwner,
  saveTextDocument,
} from "pstdio-sync";
import type { StorageGroup } from "pstdio-sync-contracts";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { runDocumentTransaction } from "./document-persistence";
import { nativeDocumentId } from "./native-record-projection";

type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export const prepareNativeRecordWrite = async (
  tx: Transaction,
  input: {
    owner: StorageOwner;
    states: Uint8Array[];
    edit: StorageGroup["edits"][number];
    content?: string;
  },
) => {
  const { owner, edit } = input;
  if (!input.states.length && input.content === undefined) return { edit, changed: [] as string[] };
  const document = new Y.Doc();
  const changed = new Set<string>();
  const write = async (key: string, content: string) => {
    const result = await runDocumentTransaction(
      tx,
      {
        owner,
        address: {
          workbench_id: owner.workbenchId,
          extension_id: owner.extensionId,
          document_id: nativeDocumentId(key),
        },
      },
      async ({ document }) => {
        await readTextDocumentSeed(document);
        saveTextDocument(document, content);
      },
    );
    if (result.changed) changed.add(key);
    result.document.destroy();
  };
  try {
    for (const state of input.states) Y.applyUpdate(document, state);
    if (input.content !== undefined) {
      const key = Object.entries(readNativeRecordSources(document, edit.recordId)).find(
        ([, source]) => "asset" in source,
      )?.[0];
      if (!key) throw new Error("This file has no native text source");
      await write(key, input.content);
    }
    const writes: { documentKey: string; content: string }[] = [];
    const prepared = prepareRecordTextEdit(document, edit, (write) => writes.push(write));
    for (const { documentKey, content } of writes) await write(documentKey, content);
    return { edit: prepared, changed: [...changed] };
  } finally {
    document.destroy();
  }
};
