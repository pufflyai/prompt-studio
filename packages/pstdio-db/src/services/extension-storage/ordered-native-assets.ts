import type { StorageOwner } from "pstdio-sync";
import { observeJson, readOrderedObservation } from "pstdio-sync/records";
import { fingerprint, type Json } from "pstdio-sync-contracts";
import type { NativeProjectedRecord } from "./native-record-projection";
import { readNativeTextIn } from "./native-record-projection";
import type { OrderedTransaction } from "./ordered-sql";

/** File content has its own Yjs owner. Its local materialization invalidates physical copies
 * without turning a file edit into a second ordered record operation. */
export const orderedAssetRevision = async (revision: string, versions: Record<string, string>) => {
  const observation = readOrderedObservation(revision);
  if (observation.value.kind !== "object") throw new Error("An ordered record needs its channel wrapper");
  observation.value.fields.nativeVersions = await observeJson(versions as Json);
  return JSON.stringify(observation);
};

export const projectOrderedNativeAssets = async (
  tx: OrderedTransaction,
  owner: StorageOwner,
  record: NativeProjectedRecord,
) => {
  if (record.deleted) return record;
  const nativeVersions: Record<string, string> = {};
  for (const [key, source] of Object.entries(record.nativeSources ?? {})) {
    if (!("asset" in source)) continue;
    const content = await readNativeTextIn(tx, owner, key);
    if (content !== undefined) nativeVersions[key] = await fingerprint(content);
  }
  if (!Object.keys(nativeVersions).length) return record;
  return { ...record, nativeVersions, revision: await orderedAssetRevision(record.revision, nativeVersions) };
};
