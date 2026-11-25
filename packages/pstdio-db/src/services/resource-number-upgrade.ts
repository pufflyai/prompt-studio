import { type NumberedResource, resourceNumbers, resourceShorthand } from "pstdio-sync/records";
import { fingerprint, storageLimits, storageRecordBytes } from "pstdio-sync-contracts";
import type * as Y from "yjs";
import type { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { isNumberRecord, numberValue } from "./extension-storage/resource-number-records";

type NumberRecords = Parameters<
  Parameters<ReturnType<ReturnType<typeof createDocumentStorageDBService>["open"]>["records"]["transaction"]>[0]
>[0];
export type LegacyNumber = NumberedResource & { aliases: string[] };

/** The retained document is read only. Author groups are bounded independently of its old encoding. */
export function* legacyNumberBatches(document: Y.Doc) {
  const history = new Map<string, Set<string>>();
  for (const key of document.getMap("resource-number-history").keys()) {
    const [id, shorthand] = JSON.parse(key) as [string, string];
    const values = history.get(id) ?? new Set<string>();
    values.add(shorthand);
    history.set(id, values);
  }
  let batch: LegacyNumber[] = [];
  let bytes = 0;
  for (const resource of resourceNumbers(document).values()) {
    const value = { ...resource, aliases: [...(history.get(resource.id) ?? [])] };
    const size = storageRecordBytes({ value, shared: null });
    if (batch.length && (batch.length === 100 || bytes + size > storageLimits.commitBytes)) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    batch.push(value);
    bytes += size;
  }
  if (batch.length) yield batch;
}

/** Existing records win; a deleted record or unrelated core JSON is never resurrected as a number. */
export const planResourceNumberBatch = async (records: Pick<NumberRecords, "readMany">, batch: LegacyNumber[]) => {
  const edits = [];
  const savedRecords = await records.readMany(batch.map((resource) => resource.id));
  for (const [index, resource] of batch.entries()) {
    const saved = savedRecords[index]!;
    if (saved.exists && !isNumberRecord(saved)) continue;
    const current = saved.exists ? numberValue(saved) : { ...resource, aliases: [] };
    const aliases = [...new Set([...current.aliases, ...resource.aliases, resourceShorthand(resource)])].sort();
    if (saved.exists && JSON.stringify(current.aliases) === JSON.stringify(aliases)) continue;
    edits.push({ recordId: resource.id, replace: { ...current, aliases } });
  }
  return edits;
};

/** Bound the final merged values too: an existing record may carry more history than its old input. */
export function* numberEditBatches(edits: Awaited<ReturnType<typeof planResourceNumberBatch>>) {
  let batch: typeof edits = [];
  let bytes = 0;
  for (const edit of edits) {
    const size = storageRecordBytes({ value: edit.replace, shared: null });
    if (batch.length && bytes + size > storageLimits.commitBytes) {
      yield batch;
      batch = [];
      bytes = 0;
    }
    batch.push(edit);
    bytes += size;
  }
  if (batch.length) yield batch;
}

export const saveResourceNumberEdits = async (
  records: Pick<NumberRecords, "commit">,
  edits: Awaited<ReturnType<typeof planResourceNumberBatch>>,
) => {
  if (edits.length) await records.commit({ operationId: `number-upgrade:${await fingerprint(edits)}`, edits });
};

export const importResourceNumberBatch = async (records: NumberRecords, batch: LegacyNumber[]) => {
  for (const edits of numberEditBatches(await planResourceNumberBatch(records, batch)))
    await saveResourceNumberEdits(records, edits);
};

/** Supported remote import adapter; retained local inputs are consumed by database admission. */
export const importResourceNumbers = async (records: NumberRecords, document: Y.Doc) => {
  for (const batch of legacyNumberBatches(document)) await importResourceNumberBatch(records, batch);
};
