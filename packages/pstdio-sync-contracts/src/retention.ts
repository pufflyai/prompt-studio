import { z } from "zod";
import { checkpointGroupSchema, coverageAckSchema, writerFrontierSchema } from "./checkpoint";
import { dictionarySchema } from "./json";
import { conflictSchema, recordSchema } from "./state";
import { assetSchema, fingerprintSchema, identitySchema, revisionSchema, scopeSchema } from "./wire";

export const coveredReceiptSchema = z
  .strictObject({
    group: checkpointGroupSchema,
    status: z.enum(["accepted", "pending", "conflict"]),
    cut: revisionSchema.nullable(),
  })
  .refine((receipt) => (receipt.status === "accepted") === (receipt.cut !== null), "Only accepted receipts have a cut");
export const coveredSnapshotSchema = z.strictObject({
  protocolVersion: z.literal(2),
  scope: scopeSchema,
  epoch: identitySchema,
  generation: revisionSchema,
  cut: revisionSchema,
  covered: revisionSchema,
  records: dictionarySchema(recordSchema),
  conflicts: dictionarySchema(conflictSchema),
  publishedRevision: identitySchema,
  documents: dictionarySchema(revisionSchema),
  receipts: dictionarySchema(coveredReceiptSchema),
  writers: dictionarySchema(writerFrontierSchema),
  retainedBranches: z.array(identitySchema),
});
export const recoveryCoverageSchema = z
  .strictObject({
    recordId: identitySchema,
    generation: revisionSchema,
    revision: revisionSchema,
    checkpointRevision: revisionSchema,
    baseCut: revisionSchema,
    branches: z.array(identitySchema),
  })
  .refine(
    (recovery) => recovery.checkpointRevision <= recovery.revision,
    "Checkpoint cannot cover future recovery edits",
  );
export const backupManifestSchema = z.strictObject({
  protocolVersion: z.literal(2),
  snapshot: coveredSnapshotSchema,
  assets: z.array(assetSchema),
  packages: z.array(assetSchema),
  copiesScope: scopeSchema,
  snapshotHash: fingerprintSchema,
  coverage: z.array(coverageAckSchema),
});
export type CoveredSnapshot = z.infer<typeof coveredSnapshotSchema>;
export type RecoveryCoverage = z.infer<typeof recoveryCoverageSchema>;

function coveredParent(snapshot: CoveredSnapshot, key: string) {
  const separator = key.lastIndexOf(":");
  const writer = key.slice(0, separator);
  const sequence = Number(key.slice(separator + 1));
  return (
    Object.hasOwn(snapshot.writers, writer) &&
    Number.isSafeInteger(sequence) &&
    sequence > 0 &&
    sequence <= snapshot.writers[writer].floor
  );
}

export function coveredAssetClosure(snapshot: CoveredSnapshot, branchIds = snapshot.retainedBranches) {
  const required = new Map<string, z.infer<typeof assetSchema>>();
  const add = (asset: z.infer<typeof assetSchema> | null | undefined) => {
    if (asset) required.set(asset.sha256, asset);
  };
  for (const record of Object.values(snapshot.records)) if (!record.deleted) add(record.asset);
  const visited = new Set<string>();
  const visit = (key: string) => {
    if (visited.has(key)) return;
    visited.add(key);
    const receipt = Object.hasOwn(snapshot.receipts, key) ? snapshot.receipts[key] : undefined;
    if (!receipt) {
      if (coveredParent(snapshot, key)) return;
      throw new Error(`Recovery ancestry unavailable: ${key}`);
    }
    for (const change of receipt.group.changes) {
      add(change.asset?.base);
      add(change.asset?.next);
    }
    for (const parent of receipt.group.parents) visit(parent);
  };
  for (const key of branchIds) visit(key);
  return [...required.values()];
}
