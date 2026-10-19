import { z } from "zod";
import { fingerprint } from "./fingerprint";
import {
  changeSchema,
  checkGroup,
  fingerprintSchema,
  identitySchema,
  resolutionSchema,
  revisionSchema,
  scopeSchema,
} from "./wire";

export const writerPositionSchema = z.strictObject({
  environmentId: identitySchema,
  sequence: z.number().int().positive(),
});
export const checkpointBodySchema = z.strictObject({
  protocolVersion: z.literal(2),
  scope: scopeSchema,
  epoch: identitySchema,
  generation: revisionSchema,
  environmentId: identitySchema,
  sequence: z.number().int().positive(),
  parents: z.array(identitySchema),
  document: z.strictObject({ recordId: identitySchema, generation: revisionSchema, recoveryRevision: revisionSchema }),
  changes: z.array(changeSchema).min(1),
  resolution: resolutionSchema.optional(),
  rebase: z
    .strictObject({
      expectedSnapshotHash: fingerprintSchema,
      sources: z.array(z.strictObject({ operationId: identitySchema, fingerprint: fingerprintSchema })).min(1),
    })
    .optional(),
});
export const checkpointGroupSchema = checkpointBodySchema
  .extend({ fingerprint: fingerprintSchema })
  .superRefine((group, ctx) => {
    checkGroup({ ...group, operationId: `${group.environmentId}:${group.sequence}` }, ctx);
    const sources = group.rebase?.sources.map((source) => source.operationId) ?? [];
    if (new Set(sources).size !== sources.length || sources.some((id) => !group.parents.includes(id)))
      ctx.addIssue({ code: "custom", message: "Rebased sources must be unique captured parents" });
    if (
      new Set(group.parents).size !== group.parents.length ||
      group.parents.includes(`${group.environmentId}:${group.sequence}`)
    )
      ctx.addIssue({ code: "custom", message: "Checkpoint parents must be unique and cannot include itself" });
    if (
      new Set(group.changes.map((change) => change.recordId)).size !== group.changes.length ||
      !group.changes.some((change) => change.recordId === group.document.recordId && change.shared?.kind === "text")
    )
      ctx.addIssue({ code: "custom", message: "Checkpoint needs a document delta and unique projection records" });
  });
export type CheckpointGroup = z.infer<typeof checkpointGroupSchema>;
export async function sealCheckpoint(body: z.infer<typeof checkpointBodySchema>) {
  const parsed = checkpointGroupSchema.parse({ ...body, fingerprint: "0".repeat(64) });
  const { fingerprint: _ignored, ...value } = parsed;
  return { ...value, fingerprint: await fingerprint(value) };
}
export async function validateCheckpoint(input: unknown) {
  const group = checkpointGroupSchema.parse(input);
  const { fingerprint: supplied, ...body } = group;
  if ((await fingerprint(body)) !== supplied) throw new Error("Checkpoint fingerprint mismatch");
  return group;
}
export const coverageAckSchema = z.strictObject({
  protocolVersion: z.literal(2),
  scope: scopeSchema,
  epoch: identitySchema,
  generation: revisionSchema,
  environmentId: identitySchema,
  cut: revisionSchema,
  snapshotHash: fingerprintSchema,
  branches: z.array(identitySchema),
  recovery: z.array(
    z
      .strictObject({
        recordId: identitySchema,
        generation: revisionSchema,
        revision: revisionSchema,
        checkpointRevision: revisionSchema,
        baseCut: revisionSchema,
        branches: z.array(identitySchema),
      })
      .refine((recovery) => recovery.checkpointRevision <= recovery.revision, "Recovery checkpoint is in the future"),
  ),
});
export const coverageResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("acknowledged"), acknowledgement: coverageAckSchema }),
  z.strictObject({ status: z.literal("snapshot-required") }),
]);
export type CoverageResult = z.infer<typeof coverageResultSchema>;
export type CoverageAck = z.infer<typeof coverageAckSchema>;
export const writerFrontierSchema = z.strictObject({ floor: revisionSchema });
export const recoveryFileSchema = z.strictObject({
  protocolVersion: z.literal(2),
  scope: scopeSchema,
  recordId: identitySchema,
  epoch: identitySchema,
  generation: revisionSchema,
  revision: revisionSchema,
  checkpointRevision: revisionSchema,
  state: z.string(),
  checkpointVector: z.string(),
  projectionBaseline: z.string(),
  frozen: z
    .strictObject({
      identity: identitySchema,
      revision: revisionSchema,
      update: z.string(),
      vector: z.string(),
      group: checkpointGroupSchema.nullable(),
      projectionBaseline: z.string(),
    })
    .nullable(),
});
export const liveFrameSchema = z.strictObject({
  protocolVersion: z.literal(2),
  scope: scopeSchema,
  epoch: identitySchema,
  documentId: identitySchema,
  generation: revisionSchema,
  kind: z.enum(["update", "state-vector", "barrier"]),
  payload: z.string(),
});
export const backupCoverageSchema = z.strictObject({
  scope: scopeSchema,
  epoch: identitySchema,
  generation: revisionSchema,
  cut: revisionSchema,
  snapshotHash: fingerprintSchema,
  manifestHash: fingerprintSchema,
});
export const documentRotationSchema = z
  .strictObject({
    scope: scopeSchema,
    epoch: identitySchema,
    documentId: identitySchema,
    previousGeneration: revisionSchema,
    generation: revisionSchema,
    seed: z.string(),
  })
  .refine(
    (rotation) => rotation.generation === rotation.previousGeneration + 1,
    "Document generation must advance once",
  );
export type DocumentRotation = z.infer<typeof documentRotationSchema>;
export const documentPositionSchema = z.strictObject({
  scope: scopeSchema,
  epoch: identitySchema,
  documentId: identitySchema,
  generation: revisionSchema,
  position: z.string(),
});
