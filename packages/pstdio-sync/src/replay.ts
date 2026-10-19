import {
  canonicalJson,
  contentSnapshot,
  type Replay,
  replaySchema,
  type Snapshot,
  snapshotSchema,
  validateMutation,
} from "pstdio-sync-contracts";
import { applyRecordChange, blankRecord } from "./records";

export const reconstructSnapshot = async (base: Snapshot, input: Replay) => {
  const replay = replaySchema.parse(input);
  if (
    canonicalJson(base.scope) !== canonicalJson(replay.scope) ||
    base.generation !== replay.generation ||
    canonicalJson(base.checkpoint) !== canonicalJson(replay.after)
  )
    throw new Error("Resynchronization required: replay does not follow the captured snapshot");
  const records = new Map(Object.entries(structuredClone(base.records)));
  const receipts = new Map(Object.entries(structuredClone(base.receipts)));
  for (const receipt of [...replay.groups, ...Object.values(replay.outstanding)]) {
    await validateMutation(receipt.mutation);
    const previous = receipts.get(receipt.operationId);
    if (previous && previous.fingerprint !== receipt.fingerprint) throw new Error("Replay changed operation identity");
    receipts.set(receipt.operationId, receipt);
  }
  for (const receipt of replay.groups)
    for (const change of receipt.mutation.changes)
      records.set(
        change.recordId,
        applyRecordChange(records.get(change.recordId) ?? blankRecord(change.recordId), change),
      );
  const { after: _after, through, groups: _groups, outstanding: _outstanding, ...boundary } = replay;
  return contentSnapshot(
    snapshotSchema.parse({
      ...boundary,
      checkpoint: through,
      records: Object.fromEntries(records),
      receipts: Object.fromEntries(receipts),
    }),
  );
};
