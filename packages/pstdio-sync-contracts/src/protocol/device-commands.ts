import { z } from "zod";
import { jsonSchema } from "../json";

/** Complete encoded input, shared with the target's incomplete-request admission pool. */
export const deviceCommandInputLimit = 64 * 1024 * 1024;

export const deviceCommandRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("challenge"), requestId: z.string().uuid() }),
  z.strictObject({
    kind: z.literal("command"),
    requestId: z.string().uuid(),
    challenge: z.string().uuid(),
    offset: z.number().int().nonnegative(),
    chunk: z.string(),
    final: z.boolean(),
  }),
]);
export const deviceCommandChallengeSchema = z.strictObject({ challenge: z.string().uuid() });
export const deviceCommandReceivedSchema = z.strictObject({ received: z.number().int().nonnegative() });
const reply = { requestId: z.string().uuid(), sequence: z.number().int().nonnegative() };
export const deviceCommandReplySchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...reply, kind: z.literal("progress"), result: jsonSchema }),
  z.strictObject({ ...reply, kind: z.literal("result"), chunk: z.string() }),
]);
