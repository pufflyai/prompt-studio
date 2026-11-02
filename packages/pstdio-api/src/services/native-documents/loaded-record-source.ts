import { createHash } from "node:crypto";
import { type StorageOwner, StorageRevisionChangedError } from "pstdio-sync";
import { nativeFieldValue } from "pstdio-sync/records";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { NativeDocumentSourceError } from "./source-error";

/** Validate complete bytes on every resolution, including a provider replacing an existing locator. */
export const validateLoadedRecordSource = async (
  storage: ExtensionsRouteDeps["extensionStorageService"],
  input: {
    owner: StorageOwner;
    recordId: string;
    documentKey: string;
    field?: string;
    content: string;
    versions: Record<string, string>;
  },
) => {
  const records = (await storage.open({ owner: input.owner })).records;
  const record = await records.read(input.recordId);
  if (!record.exists || record.deleted)
    throw new NativeDocumentSourceError(404, "native_document_source_unavailable", "The text source no longer exists");
  const versionKey = JSON.stringify([input.owner.workbenchId, input.owner.extensionId, input.recordId]);
  const expected = input.versions[versionKey];
  if (expected !== undefined && expected !== record.revision) throw new StorageRevisionChangedError();
  let matches = false;
  if (input.field) matches = nativeFieldValue(record.value, input.field) === input.content;
  else if ("nativeSources" in record && record.nativeSources?.[input.documentKey]) {
    matches =
      (await storage.openNativeTextDocument({ owner: input.owner, fileId: input.documentKey }).read()) ===
      input.content;
  } else if (record.asset) {
    const bytes = new TextEncoder().encode(input.content);
    matches =
      bytes.byteLength === record.asset.byteLength &&
      createHash("sha256").update(bytes).digest("hex") === record.asset.sha256;
  }
  if (!matches)
    throw new NativeDocumentSourceError(
      400,
      "native_document_source_invalid",
      "A text source must resolve its complete source bytes",
    );
  return { ...input.versions, [versionKey]: record.revision };
};
