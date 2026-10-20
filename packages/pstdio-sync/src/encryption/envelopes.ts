import type { LiveClientMessage, StateEnvelope, UpdateEnvelope } from "pstdio-sync-contracts";
import { decodeBytes, encodeBytes } from "../encoding";
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

export const sealState = async (
  space: SyncSpace,
  documentId: string,
  input: { baseStateId: string | null; through: number; state: Uint8Array; summary: Uint8Array; blobIds: string[] },
): Promise<StateEnvelope> => {
  const stateId = createSyncId();
  const [payload, summary] = await Promise.all([
    seal(space, ["state", documentId, stateId], input.state),
    seal(space, ["summary", documentId, stateId], input.summary),
  ]);
  return {
    stateId,
    baseStateId: input.baseStateId,
    through: input.through,
    payload: encodeBytes(payload),
    summary: encodeBytes(summary),
    blobIds: input.blobIds,
  };
};

/** Opens latest state bytes as the relay returns them from the state route. */
export const openState = (space: SyncSpace, documentId: string, stateId: string, bytes: Uint8Array) =>
  open(space, ["state", documentId, stateId], bytes);

export const openSummary = (space: SyncSpace, documentId: string, state: { stateId: string; summary: string }) =>
  open(space, ["summary", documentId, state.stateId], decodeBytes(state.summary));

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
