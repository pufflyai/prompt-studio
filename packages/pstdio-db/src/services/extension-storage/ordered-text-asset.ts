import { type StorageObserver, type StorageOwner, StorageRevisionChangedError } from "pstdio-sync";
import { nativeTextAssetKey } from "pstdio-sync/records";
import { readTextDocumentSeed, saveTextDocument } from "pstdio-sync/text";
import { runDocumentTransaction } from "./document-persistence";
import { nativeDocumentId, refreshNativeRecordText } from "./native-record-projection";
import type { OrderedTransaction } from "./ordered-sql";
import { readProjectedRecords } from "./record-queries";

/** Asset-backed files keep their independent native owner, atomically with metadata. */
export const writeOrderedTextAsset = async <T>(input: {
  tx: OrderedTransaction;
  owner: StorageOwner;
  recordId: string;
  content: string;
  observer?: StorageObserver;
  commit(): Promise<T>;
}) => {
  const { tx, owner, recordId } = input;
  const [record] = await readProjectedRecords(tx, owner, [recordId]);
  const expected = input.observer?.expected?.(owner, recordId);
  if (expected !== undefined && expected !== record!.revision) throw new StorageRevisionChangedError();
  const key = nativeTextAssetKey(record!);
  if (!key || record!.deleted) throw new Error("This file has no native text source");
  const result = await input.commit();
  const native = await runDocumentTransaction(
    tx,
    {
      owner,
      address: { workbench_id: owner.workbenchId, extension_id: owner.extensionId, document_id: nativeDocumentId(key) },
    },
    async ({ document }) => {
      await readTextDocumentSeed(document);
      saveTextDocument(document, input.content);
    },
  );
  native.document.destroy();
  if (native.changed) await refreshNativeRecordText(tx, owner, key, input.content);
  return { result, key, records: await readProjectedRecords(tx, owner, [recordId]) };
};
