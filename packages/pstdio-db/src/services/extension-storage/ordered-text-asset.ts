import { type StorageObserver, type StorageOwner, StorageRevisionChangedError } from "pstdio-sync";
import { nativeTextAssetKey } from "pstdio-sync/records";
import { readTextDocumentSeed, saveTextDocument } from "pstdio-sync/text";
import type { StorageGroup } from "pstdio-sync-contracts";
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
  replace: StorageGroup["edits"][number]["replace"];
  observer?: StorageObserver;
  commit(): Promise<T>;
}) => {
  const { tx, owner, recordId } = input;
  const [record] = await readProjectedRecords(tx, owner, [recordId]);
  const expected = input.observer?.expected?.(owner, recordId);
  if (expected !== undefined && expected !== record!.revision) throw new StorageRevisionChangedError();
  const key = nativeTextAssetKey(record!);
  if (!key || record!.deleted) throw new Error("This file has no native text source");
  // The native text owner persists file bytes. Projection of those bytes must
  // not author another record save when its metadata is unchanged.
  const result = isDeepStrictEqual(input.replace, record!.value) ? undefined : await input.commit();
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
  const projected = native.changed ? await refreshNativeRecordText(tx, owner, key, input.content) : 0;
  return {
    result,
    key,
    changed: native.changed,
    projected,
    records: await readProjectedRecords(tx, owner, [recordId]),
  };
};

import { isDeepStrictEqual } from "node:util";
