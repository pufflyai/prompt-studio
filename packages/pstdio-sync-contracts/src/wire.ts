import { z } from "zod";
import { jsonSchema } from "./json";

export type { Json } from "./json";
export { jsonSchema } from "./json";

export const identitySchema = z.string().min(1);
export const revisionSchema = z.number().int().nonnegative();
export const fingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const scopeSchema = z.strictObject({
  accountId: identitySchema,
  workbenchId: identitySchema,
  extensionId: identitySchema,
});
export const assetSchema = z.strictObject({
  sha256: fingerprintSchema,
  byteLength: revisionSchema,
  mediaType: identitySchema,
});
export const sharedSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("text"), update: z.string().min(1) }),
  z.strictObject({ kind: z.literal("list"), update: z.string().min(1) }),
  z.strictObject({
    kind: z.literal("map"),
    entries: z
      .array(
        z.strictObject({
          key: z.string(),
          expected: fingerprintSchema,
          next: z.discriminatedUnion("kind", [
            z.strictObject({ kind: z.literal("set"), value: jsonSchema }),
            z.strictObject({ kind: z.literal("delete") }),
          ]),
        }),
      )
      .min(1),
  }),
]);
export const changeSchema = z.strictObject({
  recordId: identitySchema,
  expectedRevision: revisionSchema,
  baseDeleted: z.boolean(),
  shared: sharedSchema.optional(),
  value: z.strictObject({ expected: fingerprintSchema, next: jsonSchema }).optional(),
  asset: z.strictObject({ base: assetSchema.nullable(), next: assetSchema.nullable() }).optional(),
  deleted: z.boolean().optional(),
});
export const resolutionSchema = z.strictObject({
  conflictId: identitySchema,
  expectedConflicts: z.array(z.strictObject({ conflictId: identitySchema, revision: revisionSchema })).min(1),
  capturedOperationIds: z.array(identitySchema).min(1),
  expectedInputs: z.array(z.strictObject({ recordId: identitySchema, revision: revisionSchema })).min(1),
  handler: z.strictObject({ publishedRevision: identitySchema, handlerId: identitySchema }).optional(),
});
export const documentCheckpointSchema = z.strictObject({
  recordId: identitySchema,
  generation: revisionSchema,
  recoveryRevision: revisionSchema,
});
export const streamPositionSchema = z.strictObject({
  epoch: identitySchema,
  generation: revisionSchema,
  sequence: z.number().int().positive(),
});
export const mutationBodySchema = z.strictObject({
  protocolVersion: z.literal(2),
  ...streamPositionSchema.shape,
  document: documentCheckpointSchema.optional(),
  scope: scopeSchema,
  environmentId: identitySchema,
  operationId: identitySchema,
  parents: z.array(identitySchema),
  changes: z.array(changeSchema).min(1),
  resolution: resolutionSchema.optional(),
});
export const localOperationSchema = mutationBodySchema
  .omit({ protocolVersion: true, scope: true, epoch: true, generation: true, sequence: true })
  .extend({ position: streamPositionSchema.optional() })
  .superRefine(checkGroup);
export const mutationSchema = mutationBodySchema
  .extend({ fingerprint: fingerprintSchema })
  .superRefine((group, ctx) => {
    checkGroup(group, ctx);
    if (
      group.document &&
      !group.changes.some((change) => change.recordId === group.document!.recordId && change.shared?.kind === "text")
    )
      ctx.addIssue({ code: "custom", message: "Checkpoint needs its document delta" });
  });
export type Scope = z.infer<typeof scopeSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Change = z.infer<typeof changeSchema>;
export type MutationBody = z.infer<typeof mutationBodySchema>;
export type Mutation = z.infer<typeof mutationSchema>;

export function checkGroup(
  value: Pick<MutationBody, "operationId" | "parents" | "changes" | "resolution">,
  ctx: z.RefinementCtx,
) {
  const unique = (values: string[]) => new Set(values).size === values.length;
  const records = value.changes.map((change) => change.recordId);
  if (!unique(records) || !unique(value.parents) || value.parents.includes(value.operationId)) {
    ctx.addIssue({
      code: "custom",
      message: "Records and parents must be unique; operations cannot depend on themselves",
    });
  }
  for (const change of value.changes) {
    if (!change.shared && !change.value && !change.asset && change.deleted === undefined) {
      ctx.addIssue({ code: "custom", message: "A record change must contain an edit" });
    }
    if (change.shared?.kind === "map" && !unique(change.shared.entries.map((entry) => entry.key))) {
      ctx.addIssue({ code: "custom", message: "Map keys must be unique within a change" });
    }
  }
  const resolution = value.resolution;
  if (!resolution) return;
  const inputs = resolution.expectedInputs.map((input) => input.recordId);
  if (
    !unique(resolution.expectedConflicts.map((input) => input.conflictId)) ||
    !resolution.expectedConflicts.some((input) => input.conflictId === resolution.conflictId) ||
    !unique(inputs) ||
    inputs.length !== records.length ||
    records.some((id) => !inputs.includes(id)) ||
    !unique(resolution.capturedOperationIds) ||
    resolution.capturedOperationIds.some((id) => !value.parents.includes(id))
  ) {
    ctx.addIssue({
      code: "custom",
      message: "Resolution inputs must cover the whole group and captured operations must be parents",
    });
  }
}
