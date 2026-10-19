import type { CheckpointGroup } from "../checkpoint";
import { sealMutation } from "../fingerprint";
import type { Snapshot } from "../state";
import { acceptedParent, type CoveredState, operationKey } from "./covered-state";
import { emptySnapshot, recordOutcome } from "./relay";
import { stage } from "./staging";

const recordMutation = (group: CheckpointGroup) =>
  sealMutation({
    protocolVersion: 2,
    epoch: group.epoch,
    generation: group.generation,
    sequence: group.sequence,
    document: group.document,
    scope: group.scope,
    environmentId: group.environmentId,
    operationId: operationKey(group),
    parents: group.parents,
    changes: group.changes,
    ...(group.resolution && { resolution: group.resolution }),
  });

// Reuse the existing reconciliation rules; the wire boundary remains strict protocol 2.
export async function stageCovered(state: CoveredState, group: CheckpointGroup) {
  const projection: Snapshot = {
    ...emptySnapshot(state.scope),
    records: state.records,
    conflicts: state.conflicts,
    checkpoint: { epoch: state.epoch, sequence: state.cut },
    publishedRevision: state.publishedRevision,
  };
  for (const [key, receipt] of Object.entries(state.receipts)) {
    const mutation = await recordMutation(receipt.group);
    projection.receipts[key] = {
      mutation,
      operationId: key,
      fingerprint: mutation.fingerprint,
      status: receipt.status,
      order: receipt.group.sequence,
      checkpoint: receipt.cut === null ? null : { epoch: state.epoch, sequence: receipt.cut },
      ...(receipt.status === "conflict" && { conflictId: key }),
    };
  }
  const mutation = await recordMutation(group);
  const outcome = recordOutcome(
    projection,
    mutation,
    await stage(projection, mutation, (parent) => acceptedParent(state, parent)),
  );
  state.records = projection.records;
  state.conflicts = projection.conflicts;
  state.cut = projection.checkpoint.sequence;
  return outcome.status;
}
