import type { Snapshot } from "../state";
import { completedOperations } from "./completed-operations";
import { own } from "./dictionary";
import type { LocalState } from "./local-store";

export function recoverMissingAcceptedWork(state: LocalState, incoming: Snapshot) {
  const local = [...Object.values(state.accepted.receipts), ...state.pending];
  for (const operation of local) {
    const remote = own(incoming.receipts, operation.operationId);
    if (remote && remote.fingerprint !== operation.fingerprint)
      throw new Error("Restored receipt fingerprint differs from retained local work");
  }
  const required = new Set<string>();
  const visit = (id: string) => {
    if (required.has(id)) return;
    const receipt = own(state.accepted.receipts, id);
    if (!receipt) return;
    const remote = own(incoming.receipts, id);
    if (remote && (remote.status === "accepted" || remote.status === receipt.status)) return;
    required.add(id);
    for (const parent of receipt.mutation.parents) visit(parent);
  };
  for (const receipt of Object.values(state.accepted.receipts))
    if (receipt.status === "accepted") visit(receipt.operationId);
  for (const mutation of state.pending) for (const parent of mutation.parents) visit(parent);
  const missing = Object.values(state.accepted.receipts)
    .filter((receipt) => required.has(receipt.operationId))
    .sort((a, b) => a.order - b.order)
    .map((receipt) => receipt.mutation);
  const ids = new Set(missing.map((mutation) => mutation.operationId));
  state.pending = [...missing, ...state.pending.filter((mutation) => !ids.has(mutation.operationId))];
}

export function reconcileAcknowledgments(state: LocalState) {
  const completed = completedOperations(state.accepted);
  state.pending = state.pending.filter((mutation) => !completed.has(mutation.operationId));
}
