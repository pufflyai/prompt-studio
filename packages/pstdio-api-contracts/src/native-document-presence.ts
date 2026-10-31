import { z } from "zod";

export const nativePresenceLimits = { bytes: 4096, label: 64, rooms: 32, heartbeatMs: 10_000, leaseMs: 30_000 };
const documentKey = z.string().regex(/^[a-f0-9]{64}$/);
export const nativeDocumentSelectionSchema = z.strictObject({ anchor: z.base64(), head: z.base64() }).nullable();
const address = {
  kind: z.literal("native-document-presence"),
  version: z.literal(1),
  extensionId: z.string().min(1),
  documentKey,
  participantId: z.uuid(),
};
const presence = z.strictObject({
  ...address,
  action: z.literal("upsert"),
  seedId: documentKey,
  label: z.string().max(nativePresenceLimits.label),
  deviceName: z.string().max(nativePresenceLimits.label),
  selection: nativeDocumentSelectionSchema,
});
export const nativePresenceLiveSchema = z
  .discriminatedUnion("action", [presence, z.strictObject({ ...address, action: z.literal("leave") })])
  .refine((value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= nativePresenceLimits.bytes, {
    message: "Presence exceeds its encoded size limit",
  });
export const nativePresenceUpdateSchema = z.strictObject({
  roomId: z.uuid(),
  participantId: z.uuid(),
  seedId: documentKey,
  selection: nativeDocumentSelectionSchema,
});
export type NativePresenceLive = z.infer<typeof nativePresenceLiveSchema>;
export type NativeDocumentSelection = z.infer<typeof nativeDocumentSelectionSchema>;
export const nativeParticipantSchema = presence.extend({ deviceId: z.string().min(1) });
export const nativePresenceSnapshotSchema = z.strictObject({
  participantId: z.uuid(),
  participants: z.array(nativeParticipantSchema),
});
export type NativeParticipant = z.infer<typeof nativeParticipantSchema>;
export type NativePresenceSnapshot = z.infer<typeof nativePresenceSnapshotSchema>;
