import { type CheckpointGroup, validateCheckpoint } from "../checkpoint";
import { canonicalJson } from "../fingerprint";
import type { Scope } from "../wire";
import { validateRebase } from "./covered-rebase";
import { stageCovered } from "./covered-staging";
import {
  acceptedParent,
  type CoveredState,
  type CoveredTransaction,
  documentGeneration,
  operationKey,
} from "./covered-state";
import type { TestObjects } from "./objects";

function currentGeneration(state: CoveredState, group: CheckpointGroup) {
  return (
    group.epoch === state.epoch &&
    group.generation === state.generation &&
    group.sequence > state.writers[group.environmentId].floor &&
    group.document.generation === documentGeneration(state, group.document.recordId)
  );
}
async function stageCheckpoint(state: CoveredState, group: CheckpointGroup, objects: TestObjects) {
  const captured = new Set(group.resolution?.capturedOperationIds ?? []);
  for (const source of group.rebase?.sources ?? []) captured.add(source.operationId);
  const waiting = group.parents.some((parent) => !captured.has(parent) && !acceptedParent(state, parent));
  const assets = group.changes.flatMap((change) => (change.asset?.next ? [change.asset.next] : []));
  const missing = (await Promise.all(assets.map((asset) => objects.get(group.scope, asset)))).some(
    (bytes) => bytes === null,
  );
  if (waiting || missing) return { status: "pending" as const, assets };
  return { status: await stageCovered(state, group), assets };
}
export async function submitCovered(
  transaction: CoveredTransaction,
  objects: TestObjects,
  scope: Scope,
  authenticated: string,
  input: CheckpointGroup,
  fault?: string,
) {
  const group = await validateCheckpoint(input);
  const result = await transaction(scope, async (state) => {
    if (
      canonicalJson(scope) !== canonicalJson(group.scope) ||
      authenticated !== group.environmentId ||
      !Object.hasOwn(state.writers, authenticated)
    )
      throw new Error("authorization");
    if (!currentGeneration(state, group)) return { status: "resynchronize" as const, proposal: group };
    const key = operationKey(group);
    const previous = state.receipts[key];
    if (previous && previous.group.fingerprint !== group.fingerprint)
      throw new Error("identity reused with changed bytes");
    if (previous && previous.status !== "pending") return previous;
    await validateRebase(state, group, previous);
    if (state.barrier?.documentId === group.document.recordId && state.barrier.joined.includes(authenticated))
      throw new Error("Writer is fenced by the document barrier");
    const { status, assets } = await stageCheckpoint(state, group, objects);
    const receipt = { group, status, cut: status === "accepted" ? state.cut : null };
    state.receipts[key] = receipt;
    state.assets = [...new Map([...state.assets, ...assets].map((asset) => [asset.sha256, asset])).values()];
    if (fault === "before-commit") throw new Error("before commit");
    return receipt;
  });
  if (fault === "after-commit") throw new Error("after commit before acknowledgement");
  return result;
}
