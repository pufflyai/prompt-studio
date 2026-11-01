import { z } from "zod";
import { identitySchema } from "../wire";
import { payloadSchema, sequenceSchema, syncIdSchema } from "./envelopes";

/** Live routing evolves independently of the durable HTTP protocol. */
export const liveProtocolVersion = 2;
export const liveProtocolHeader = "pstdio-live-protocol";
const space = { spaceOwner: identitySchema.nullable() };
const topic = { ...space, topic: syncIdSchema };
const call = { id: identitySchema };
const procedure = { ...space, procedure: syncIdSchema };
const callError = z.enum(["unavailable", "disconnected", "cancelled", "failed", "limit-exceeded"]);

export const liveClientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.enum(["subscribe", "unsubscribe", "follow", "unfollow"]), ...topic }),
  z.strictObject({ type: z.enum(["discover", "undiscover"]), ...space }),
  z.strictObject({ type: z.literal("publish"), ...topic, payload: payloadSchema }),
  z.strictObject({ type: z.enum(["register", "unregister"]), ...procedure }),
  z.strictObject({ type: z.literal("call"), ...call, ...procedure, deviceId: identitySchema, payload: payloadSchema }),
  z.strictObject({ type: z.literal("cancel"), ...call }),
  z.strictObject({ type: z.literal("result"), ...call, payload: payloadSchema, done: z.boolean() }),
  z.strictObject({ type: z.literal("call-error"), ...call, error: callError }),
]);
export const liveServerMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ready"), protocolVersion: z.number().int().positive() }),
  z.strictObject({ type: z.literal("event"), ...topic, deviceId: identitySchema, payload: payloadSchema }),
  z.strictObject({ type: z.literal("subscribers"), ...topic, active: z.boolean() }),
  z.strictObject({
    type: z.enum(["changed", "discovered"]),
    ...space,
    documentId: syncIdSchema,
    lastSequence: sequenceSchema,
    stateId: syncIdSchema.nullable(),
  }),
  z.strictObject({
    type: z.literal("invocation"),
    ...call,
    ...procedure,
    deviceId: identitySchema,
    payload: payloadSchema,
  }),
  z.strictObject({ type: z.literal("cancelled"), ...call }),
  z.strictObject({
    type: z.literal("result"),
    ...call,
    deviceId: identitySchema,
    payload: payloadSchema,
    done: z.boolean(),
  }),
  z.strictObject({ type: z.literal("call-error"), ...call, error: callError }),
]);
export type LiveClientMessage = z.infer<typeof liveClientMessageSchema>;
export type LiveServerMessage = z.infer<typeof liveServerMessageSchema>;

export const signedDeviceCallSchema = z.strictObject({ payload: payloadSchema, signature: payloadSchema });
