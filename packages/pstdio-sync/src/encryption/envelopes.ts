import type { LiveClientMessage, StateEnvelope, UpdateEnvelope } from "pstdio-sync-contracts";
import { decodeBytes, encodeBytes } from "../shared";
import { open, seal } from "./sealing";
import { createSyncId, type SyncSpace } from "./space";

// These functions are the transport boundary: plaintext goes in, only relay envelopes come out.

export const sealUpdate = async (
  space: SyncSpace,
  documentId: string,
  update: Uint8Array,
  blobIds: string[],
): Promise<UpdateEnvelope> => {
  const updateId = createSyncId();
  const payload = encodeBytes(await seal(space, ["update", documentId, updateId], update));
  return { updateId, payload, blobIds };
};

export const openUpdate = (space: SyncSpace, documentId: string, update: { updateId: string; payload: string }) =>
  open(space, ["update", documentId, update.updateId], decodeBytes(update.payload));

type StateHeader = { stateId: string; baseStateId: string | null; through: number };

// The relay reads a state's base and last included update in the clear. Both are authenticated, so a
// changed value fails the open instead of making a device skip updates it never received.
const stateContext = (kind: "state" | "summary", documentId: string, state: StateHeader) => [
  kind,
  documentId,
  state.stateId,
  state.baseStateId,
  state.through,
];

export const sealState = async (
  space: SyncSpace,
  documentId: string,
  input: { baseStateId: string | null; through: number; state: Uint8Array; summary: Uint8Array; blobIds: string[] },
): Promise<StateEnvelope> => {
  const header = { stateId: createSyncId(), baseStateId: input.baseStateId, through: input.through };
  const [payload, summary] = await Promise.all([
    seal(space, stateContext("state", documentId, header), input.state),
    seal(space, stateContext("summary", documentId, header), input.summary),
  ]);
  return { ...header, payload: encodeBytes(payload), summary: encodeBytes(summary), blobIds: input.blobIds };
};

/** Opens latest state bytes as the relay returns them from the state route, checked against its metadata. */
export const openState = (space: SyncSpace, documentId: string, state: StateHeader, bytes: Uint8Array) =>
  open(space, stateContext("state", documentId, state), bytes);

export const openSummary = (space: SyncSpace, documentId: string, state: StateHeader & { summary: string }) =>
  open(space, stateContext("summary", documentId, state), decodeBytes(state.summary));

export const sealBlob = async (space: SyncSpace, bytes: Uint8Array) => {
  const blobId = createSyncId();
  return { blobId, bytes: await seal(space, ["blob", blobId], bytes) };
};

export const openBlob = (space: SyncSpace, blobId: string, bytes: Uint8Array) => open(space, ["blob", blobId], bytes);

/** Live messages name the sending device, so the relay cannot present one device's message as another's. */
export const sealLive = async (
  space: SyncSpace,
  deviceId: string,
  message: Uint8Array,
): Promise<LiveClientMessage> => ({
  type: "live",
  spaceOwner: space.spaceOwner,
  payload: encodeBytes(await seal(space, ["live", deviceId], message)),
});

export const openLive = (space: SyncSpace, message: { deviceId: string; payload: string }) =>
  open(space, ["live", message.deviceId], decodeBytes(message.payload));
