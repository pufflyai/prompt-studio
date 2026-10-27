import { assetSchema, fingerprint } from "pstdio-sync-contracts";
import * as Y from "yjs";
import { recordTypeName } from "../document-edits";
import { encodeBytes } from "../encoding";
import { type SyncSpace, sealUpdate } from "../encryption";
import { NativeSourceRecoveryError } from "../native-source-recovery";
import type { AssetStore } from "../types";
import type { SyncFailure } from "./document-sync-types";
import { encodeRecordFrame, type RecordFrame } from "./record-frames";
import type { RecordStreamInput } from "./record-stream-types";

type Quarantine = (failure: SyncFailure) => Promise<void>;
interface Scope {
  space: SyncSpace;
  documentId: string;
}

const retain = async (scope: Scope, bytes: Uint8Array, format: string, quarantine: Quarantine, asset?: unknown) => {
  const id = `source:${await fingerprint({ format, bytes: encodeBytes(bytes) })}`;
  await quarantine({
    kind: "update",
    id,
    reason: "source-history",
    envelope: {
      format,
      ...(asset ? { asset } : {}),
      update: await sealUpdate(scope.space, scope.documentId, bytes, []),
    },
  });
};

export const withSourceRecovery = async <T>(
  action: () => Promise<T>,
  retain: (error: NativeSourceRecoveryError) => Promise<void>,
) => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof NativeSourceRecoveryError) await retain(error);
    throw error;
  }
};

export const retainNativeSource = (scope: Scope, document: Y.Doc, quarantine: Quarantine) =>
  retain(scope, Y.encodeStateAsUpdate(document), "native-source-document", quarantine);

export const retainRecordSourceFrames = async (
  scope: Scope & { assets?: AssetStore },
  frames: (RecordFrame | null)[],
  error: NativeSourceRecoveryError,
  quarantine: Quarantine,
) => {
  const selected = frames.filter(
    (frame): frame is RecordFrame =>
      !!frame && (!error.recordId || frame.records.some((record) => record.recordId === error.recordId)),
  );
  const assets = new Map<string, RecordFrame["assets"][number]["asset"]>();
  for (const frame of selected) {
    await retain(scope, encodeRecordFrame(frame), "native-source-records", quarantine);
    for (const reference of frame.assets) assets.set(reference.asset.sha256, reference.asset);
  }
  if (scope.assets)
    for (const asset of assets.values()) {
      const bytes = new Uint8Array(await new Response(await scope.assets.read(asset)).arrayBuffer());
      await retain(scope, bytes, "native-source-asset", quarantine, asset);
    }
};

export const retainRecordSourceMap = async (
  input: RecordStreamInput,
  remote: Map<string, Uint8Array[]>,
  error: NativeSourceRecoveryError,
  quarantine: Quarantine,
) => {
  for (const [recordId, updates] of remote) {
    if (error.recordId && error.recordId !== recordId) continue;
    const bytes = Y.mergeUpdates(updates);
    await retain(
      input,
      encodeRecordFrame({ records: [{ recordId, bytes }], assets: [] }),
      "native-source-records",
      quarantine,
    );
    if (!input.assets) continue;
    const document = new Y.Doc();
    try {
      Y.applyUpdate(document, bytes);
      const asset = assetSchema.safeParse(document.getMap(recordTypeName(recordId)).get("asset"));
      if (asset.success) {
        const bytes = new Uint8Array(await new Response(await input.assets.read(asset.data)).arrayBuffer());
        await retain(input, bytes, "native-source-asset", quarantine, asset.data);
      }
    } finally {
      document.destroy();
    }
  }
};
