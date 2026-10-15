import { negotiate, type Peer, protocolPeer } from "../compatibility";
import type { Receipt } from "../state";
import type { Mutation, Scope } from "../wire";
import type { LocalState } from "./local-store";
import type { TestObjects } from "./objects";
import { reconcileAcknowledgments, recoverMissingAcceptedWork } from "./recovery";
import type { TestRelay } from "./relay";

export interface SyncOptions {
  crash?: "before-commit" | "after-commit";
  peer?: Peer;
  upload?: boolean;
}
async function upload(state: LocalState, mutation: Mutation, objects: TestObjects) {
  for (const change of mutation.changes) {
    const asset = change.asset?.next;
    if (asset && state.blobs[asset.sha256])
      await objects.put(mutation.scope, asset, Buffer.from(state.blobs[asset.sha256], "base64"));
  }
}
async function download(state: LocalState, scope: Scope, objects: TestObjects) {
  for (const receipt of Object.values(state.accepted.receipts))
    for (const change of receipt.mutation.changes) {
      if (!change.asset?.next) continue;
      const bytes = await objects.get(scope, change.asset.next);
      if (bytes) state.blobs[change.asset.next.sha256] = Buffer.from(bytes).toString("base64");
    }
}
export async function synchronize(
  state: LocalState,
  scope: Scope,
  relay: TestRelay,
  objects: TestObjects,
  options: SyncOptions,
) {
  const compatibility = negotiate(protocolPeer, options.peer ?? protocolPeer);
  if (compatibility.status !== "compatible") return { ...compatibility, outcomes: [] as Receipt[] };
  const incoming = await relay.snapshot(scope);
  recoverMissingAcceptedWork(state, incoming);
  state.accepted = incoming;
  reconcileAcknowledgments(state);
  const outcomes: Receipt[] = [];
  for (const mutation of state.pending) {
    if (options.upload !== false) await upload(state, mutation, objects);
    outcomes.push(await relay.submit(mutation, options.crash));
  }
  state.accepted = await relay.snapshot(scope);
  await download(state, scope, objects);
  reconcileAcknowledgments(state);
  if (outcomes.some((receipt) => receipt.status === "conflict")) return { status: "conflict" as const, outcomes };
  if (state.pending.length) return { status: "pending" as const, outcomes };
  return { status: "synchronized" as const, outcomes };
}
