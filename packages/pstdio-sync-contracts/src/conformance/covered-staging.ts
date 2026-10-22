import type { CheckpointGroup } from "../checkpoint";
import { sealMutation } from "../fingerprint";
import type { Snapshot } from "../state";
import { acceptedParent, type CoveredState, operationKey } from "./covered-state";
import { emptySnapshot, recordOutcome } from "./relay";
import { stage } from "./staging";

const legacyMutation = (group: CheckpointGroup) =>
  sealMutation({
    protocolVersion: 1,
    scope: group.scope,
    environmentId: group.environmentId,
    operationId: operationKey(group),
    parents: group.parents,
    changes: group.changes,
    ...(group.resolution && { resolution: group.resolution }),
  });

// Reuse the existing reconciliation rules; the wire boundary remains strict protocol 2.
export async function stageCovered(state: CoveredState, group: CheckpointGroup) {
  const legacy: Snapshot = {
    ...emptySnapshot(state.scope),
    records: state.records,
    conflicts: state.conflicts,
    checkpoint: { epoch: state.epoch, sequence: state.cut },
    publishedRevision: state.publishedRevision,
  };
  for (const [key, receipt] of Object.entries(state.receipts)) {
    const mutation = await legacyMutation(receipt.group);
    legacy.receipts[key] = {
      mutation,
      operationId: key,
      fingerprint: mutation.fingerprint,
      status: receipt.status,
      order: receipt.group.sequence,
      checkpoint: receipt.cut === null ? null : { epoch: state.epoch, sequence: receipt.cut },
      ...(receipt.status === "conflict" && { conflictId: key }),
    };
  }
  const mutation = await legacyMutation(group);
  const outcome = recordOutcome(
    legacy,
    mutation,
    await stage(legacy, mutation, (parent) => acceptedParent(state, parent)),
  );
  state.records = legacy.records;
  state.conflicts = legacy.conflicts;
  state.cut = legacy.checkpoint.sequence;
  return outcome.status;
}
