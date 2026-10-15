import { z } from "zod";
import { canonicalJson } from "./fingerprint";
import { checkpointSchema, receiptSchema } from "./state";
import { scopeSchema } from "./wire";

export const replaySchema = z
  .strictObject({
    protocolVersion: z.literal(1),
    scope: scopeSchema,
    after: checkpointSchema,
    through: checkpointSchema,
    groups: z.array(receiptSchema),
  })
  .superRefine((batch, ctx) => {
    const sameEpoch = batch.after.epoch === batch.through.epoch;
    const complete = batch.through.sequence - batch.after.sequence === batch.groups.length;
    const validGroups = batch.groups.every(
      (group, index) =>
        group.status === "accepted" &&
        group.checkpoint?.epoch === batch.through.epoch &&
        group.checkpoint.sequence === batch.after.sequence + index + 1 &&
        canonicalJson(group.mutation.scope) === canonicalJson(batch.scope),
    );
    const unique = new Set(batch.groups.map((group) => group.operationId)).size === batch.groups.length;
    if (!sameEpoch || !complete || !validGroups || !unique)
      ctx.addIssue({
        code: "custom",
        message: "Replay must contain contiguous complete accepted groups in one scope and epoch",
      });
  });
export type Replay = z.infer<typeof replaySchema>;
