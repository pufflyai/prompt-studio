import { canonicalJson, signedDeviceCallSchema } from "pstdio-sync-contracts";
import { decodeBytes, encodeBytes } from "../encoding";
import { open, seal, UnreadableSyncData } from "./sealing";
import type { SyncSpace } from "./space";

interface DeviceCallContext {
  callerDeviceId: string;
  targetDeviceId: string;
  procedure: string;
}
const context = (input: DeviceCallContext) => [
  "device-call-v2",
  input.callerDeviceId,
  input.targetDeviceId,
  input.procedure,
];
const signedBytes = (space: SyncSpace, input: DeviceCallContext, payload: string) =>
  new TextEncoder().encode(canonicalJson([space.projectId, space.spaceOwner, ...context(input), payload]));

/** The signing key belongs to the caller device; never send it to the relay. */
export const sealDeviceCall = async (
  space: SyncSpace,
  input: DeviceCallContext,
  key: CryptoKey,
  message: Uint8Array,
) => {
  const payload = encodeBytes(message);
  const signature = encodeBytes(
    new Uint8Array(await crypto.subtle.sign("Ed25519", key, signedBytes(space, input, payload))),
  );
  return encodeBytes(
    await seal(space, context(input), new TextEncoder().encode(JSON.stringify({ payload, signature }))),
  );
};

/** Resolve the public key from the device's trusted identity, never from the received payload. */
export const openDeviceCall = async (
  space: SyncSpace,
  input: DeviceCallContext,
  trustedKey: CryptoKey,
  payload: string,
) => {
  const bytes = await open(space, context(input), decodeBytes(payload));
  const signed = signedDeviceCallSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  const valid = await crypto.subtle.verify(
    "Ed25519",
    trustedKey,
    decodeBytes(signed.signature),
    signedBytes(space, input, signed.payload),
  );
  if (!valid) throw new UnreadableSyncData();
  return decodeBytes(signed.payload);
};
