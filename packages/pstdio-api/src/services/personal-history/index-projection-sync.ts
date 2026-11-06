import type { PersonalIndexAccepted } from "pstdio-db";
import type { StorageOwner } from "pstdio-sync";
import { openState, type SyncSpace, sealState } from "pstdio-sync/encryption";
import { createLogTransfers, type LogStreamStore } from "pstdio-sync/logs";
import type { DocumentRelay } from "pstdio-sync/relay";
import { type OrderedIndexReference, readOrderedIndexReference } from "pstdio-sync/relay";
import type { StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { readPersonalIndexDelta } from "./index-entry";
import { readIndexProjection, writeIndexProjection } from "./index-projection-pages";

export const personalIndexLogName = (writerId: string) =>
  JSON.stringify(["pstdio.personal-history", "device-index-v2", writerId]);
interface Input {
  owner: StorageOwner;
  sourceId: string;
  accountId: string;
  index: RouteDeps["extensionStorageService"]["personalHistoryIndex"];
  store: LogStreamStore;
  space: SyncSpace;
  documentId: string;
  relay: DocumentRelay;
  transfers: ReturnType<typeof createLogTransfers>;
}
interface State {
  info: StateInfo | null;
  root: OrderedIndexReference | null;
  offset: number;
}
const openIndexState = async (input: Input, info: StateInfo | null): Promise<State> => {
  if (!info) return { info, root: null, offset: 0 };
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await openState(input.space, input.documentId, info, await input.relay.state(info)),
    ),
  );
  if (
    !value ||
    Object.keys(value).length !== 4 ||
    value.format !== "device-index-projection" ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0
  )
    throw new Error("Invalid private index snapshot");
  return { info, root: value.root === null ? null : readOrderedIndexReference(value.root), offset: value.offset };
};
const snapshotIndex = async (input: Input, base: State, offset: number, through: number) => {
  const { nodes } = await input.transfers.connect();
  const root = await writeIndexProjection(nodes, input.index, input.owner, input.sourceId);
  const state = await sealState(input.space, input.documentId, {
    baseStateId: base.info?.stateId ?? null,
    through,
    state: new TextEncoder().encode(JSON.stringify({ version: 1, format: "device-index-projection", root, offset })),
    summary: new TextEncoder().encode(JSON.stringify({ format: "device-index-projection" })),
    blobIds: root ? [root.blobId] : [],
  });
  return input.relay.replace(state);
};
const applyIndexUpdate = async (
  input: Input,
  state: State,
  update: Pick<StoredUpdate, "updateId" | "payload" | "sequence">,
) => {
  const metadata = await input.transfers.wireUpdate(update);
  const entries = await input.transfers.materialize(metadata, new Set(metadata.map((_, index) => index)));
  const sequence = state.offset + update.sequence;
  const accepted: PersonalIndexAccepted[] = entries.map((entry, index) => {
    if (!entry || entry.writerId !== input.sourceId) throw new Error("Private index update writer changed");
    return {
      entryId: entry.id,
      sequence,
      index,
      delta: readPersonalIndexDelta(entry.value, input.sourceId, input.accountId),
    };
  });
  await input.store.receive(
    [{ sequence, entries, expected: metadata.map((entry) => ({ id: entry.id, fingerprint: entry.fingerprint })) }],
    sequence,
    { from: sequence - 1 },
  );
  await input.index.accept(input.owner, input.sourceId, sequence, accepted);
  return sequence;
};
const readIndexTail = async (
  input: Input,
  state: State,
  after: number,
  first: Awaited<ReturnType<DocumentRelay["read"]>>,
) => {
  let page =
    after === state.offset && first.status === "updates" ? first : await input.relay.read(after - state.offset);
  while (true) {
    if (page.status !== "updates") throw new Error("Private index snapshot unavailable");
    for (const update of page.updates) {
      if (update.sequence <= after - state.offset) continue;
      if (update.sequence !== after - state.offset + 1) throw new Error("Private index log sequence has a gap");
      after = await applyIndexUpdate(input, state, update);
    }
    if (!page.more) {
      if (after - state.offset !== page.lastSequence) throw new Error("Private index log tail is missing");
      return after;
    }
    page = await input.relay.read(after - state.offset);
  }
};
const readIndex = async (input: Input, own: boolean) => {
  let after = await input.index.sourcePosition(input.owner, input.sourceId);
  let first = await input.relay.read(0);
  let state = await openIndexState(input, first.state);
  if (!first.state && first.lastSequence === 0 && after > 0) {
    if (!own) throw new Error("Restoring a device index requires its writer");
    await snapshotIndex(input, state, after, 0);
    first = await input.relay.read(0);
    state = await openIndexState(input, first.state);
  }
  const covered = state.offset + (state.info?.through ?? 0);
  if (state.info && covered > after) {
    const { nodes } = await input.transfers.connect();
    for await (const page of readIndexProjection(nodes, state.root, input.sourceId, input.accountId, covered))
      await input.index.accept(input.owner, input.sourceId, null, page);
    await input.index.accept(input.owner, input.sourceId, covered, []);
    after = covered;
  }
  after = await readIndexTail(input, state, after, first);
  return { state, after };
};

/** Current-row snapshots are private derived projections. Public append logs retain their complete entry history. */
export const synchronizeIndexProjection = async (
  input: Omit<Input, "transfers"> & { manifestBlobs: Parameters<typeof createLogTransfers>[0]["manifestBlobs"] },
  own: boolean,
) => {
  const transfers = createLogTransfers(input);
  const current = { ...input, transfers };
  let { state, after } = await readIndex(current, own);
  if (!own) return;
  const ceiling = await input.store.pendingThrough();
  while (true) {
    const pending = await input.store.pending(100, ceiling);
    if (!pending.length) break;
    const delivery = await transfers.prepare(pending);
    const { blobs } = await transfers.connect();
    for (const blob of delivery.blobs) await blobs.put(blob.blobId, Buffer.from(blob.bytes, "base64"), blob.children);
    const result = await input.relay.update(delivery.envelope);
    if (result.sequence !== after - state.offset + 1) {
      ({ state, after } = await readIndex(current, own));
    } else after = await applyIndexUpdate(current, state, { ...delivery.envelope, sequence: result.sequence });
  }
  if (after - state.offset - (state.info?.through ?? 0) >= 1000)
    await snapshotIndex(current, state, state.offset, after - state.offset);
};
