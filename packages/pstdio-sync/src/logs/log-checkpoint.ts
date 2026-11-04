import { sealState } from "../encryption";
import { logBatchEnd } from "./log-cursor";
import { createLogPageIndex } from "./log-page-index";
import { openLogState } from "./log-state";
import type { createLogTransfers } from "./log-transfer";
import type { LogSyncInput } from "./log-types";

type Transfers = ReturnType<typeof createLogTransfers>;
export const publishLogCheckpoint = async (input: LogSyncInput, transfers: Transfers, found = false) => {
  if (input.canCompact === false) return false;
  const { relay, store, space, documentId } = input;
  const first = await relay.read(0);
  const status = await store.status();
  const state = await openLogState(space, documentId, relay, first.state);
  if (status.completeThrough < (found ? status.head : state.offset + first.lastSequence)) return false;
  const { nodes } = await transfers.connect();
  const index = createLogPageIndex(nodes);
  let root = found ? null : await index.prune(state.root, store.cutoff());
  const ceiling = found ? status.head : state.offset + first.lastSequence;
  let after = { sequence: found ? 0 : state.offset + (first.state?.through ?? 0), index: logBatchEnd };
  while (true) {
    const page = (await store.snapshotPage(after, 100)).filter((row) => row.sequence <= ceiling);
    if (!page.length) break;
    root = await index.append(root, page);
    after = page.at(-1)!;
  }
  const offset = found ? status.head : state.offset;
  const through = found ? 0 : first.lastSequence;
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, format: "append-log", root, offset }));
  const sealed = await sealState(space, documentId, {
    baseStateId: found ? null : (first.state?.stateId ?? null),
    through,
    state: bytes,
    summary: new TextEncoder().encode(JSON.stringify({ format: "append-log" })),
    blobIds: root ? [root.blobId] : [],
  });
  if (!(await relay.replace(sealed))) return false;
  await store.receive([], offset + through, { stateId: sealed.stateId, through });
  return true;
};

/** An empty remote after previously ordered data proves loss; a cache miss does not. */
export const ensureLogHistory = async (input: LogSyncInput, transfers: Transfers) => {
  const first = await input.relay.read(0);
  const status = await input.store.status();
  if (first.state || first.lastSequence || !status.head) return first;
  if (input.canCompact === false) throw new Error("Restoring a device log requires its writer");
  if (status.completeThrough < status.head)
    throw new Error("Restoring this log requires a device with its full retained history");
  await publishLogCheckpoint(input, transfers, true);
  return input.relay.read(0);
};
