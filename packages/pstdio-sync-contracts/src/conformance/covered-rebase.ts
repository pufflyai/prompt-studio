import type { CheckpointGroup } from "../checkpoint";
import { canonicalJson } from "../fingerprint";
import type { Change } from "../wire";
import { acceptedParent, type CoveredReceipt, type CoveredState, settledCuts, snapshotHash } from "./covered-state";

function preservePreconditions(source: Change, next: Change | undefined) {
  if (!next || source.expectedRevision !== next.expectedRevision || source.baseDeleted !== next.baseDeleted)
    return false;
  if (source.value && source.value.expected !== next.value?.expected) return false;
  if (source.asset && (!next.asset || canonicalJson(source.asset.base) !== canonicalJson(next.asset.base)))
    return false;
  if (source.shared && source.shared.kind !== next.shared?.kind) return false;
  if (source.shared?.kind === "map") {
    const entries = next.shared?.kind === "map" ? next.shared.entries : [];
    if (
      source.shared.entries.some(
        (entry) => !entries.some((next) => next.key === entry.key && next.expected === entry.expected),
      )
    )
      return false;
  }
  return source.deleted === next.deleted;
}
export async function validateRebase(state: CoveredState, group: CheckpointGroup, previous?: CoveredReceipt) {
  if (!group.rebase) return;
  if (group.resolution || (!previous && group.rebase.expectedSnapshotHash !== (await snapshotHash(state))))
    throw new Error("Stale recovery rebase snapshot");
  const captured = new Set(group.rebase.sources.map((source) => source.operationId));
  const settled = settledCuts(state);
  for (const source of group.rebase.sources) {
    const receipt = state.receipts[source.operationId];
    if (
      !receipt ||
      settled.has(source.operationId) ||
      receipt.status !== "pending" ||
      receipt.group.environmentId !== group.environmentId ||
      receipt.group.fingerprint !== source.fingerprint ||
      (receipt.group.epoch === state.epoch && receipt.group.generation === state.generation)
    )
      throw new Error("Recovery source must be an exact retired pending proposal from this writer");
    if (receipt.group.parents.some((parent) => !captured.has(parent) && !acceptedParent(state, parent)))
      throw new Error("Recovery rebase omits pending ancestry");
    for (const change of receipt.group.changes)
      if (
        !preservePreconditions(
          change,
          group.changes.find((next) => next.recordId === change.recordId),
        )
      )
        throw new Error("Recovery rebase changed observed preconditions");
  }
}
