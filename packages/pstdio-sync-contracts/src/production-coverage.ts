import { z } from "zod";
import { canonicalJson, fingerprint } from "./fingerprint";
import { coveredAssetClosure, coveredSnapshotSchema } from "./retention";
import type { Snapshot } from "./state";
import { snapshotSchema } from "./state";
import { assetSchema, fingerprintSchema, identitySchema, scopeSchema } from "./wire";

export const asCoveredSnapshot = (snapshot: Snapshot) =>
  coveredSnapshotSchema.parse({
    protocolVersion: 2,
    scope: snapshot.scope,
    epoch: snapshot.checkpoint.epoch,
    generation: snapshot.generation,
    cut: snapshot.checkpoint.sequence,
    covered: snapshot.covered,
    records: snapshot.records,
    conflicts: snapshot.conflicts,
    publishedRevision: snapshot.publishedRevision,
    documents: snapshot.documents,
    writers: snapshot.writers,
    retainedBranches: snapshot.retainedBranches,
    receipts: Object.fromEntries(
      Object.entries(snapshot.receipts).map(([id, receipt]) => [
        id,
        {
          group: receipt.mutation,
          status: receipt.status,
          cut: receipt.checkpoint?.sequence ?? null,
        },
      ]),
    ),
  });
export const snapshotAssets = (snapshot: Snapshot) => coveredAssetClosure(asCoveredSnapshot(snapshot));

// Independent captures retain every byte needed by the uncovered database tail too.
export const snapshotRecoveryAssets = (snapshot: Snapshot) => {
  const assets = new Map(snapshotAssets(snapshot).map((asset) => [canonicalJson(asset), asset]));
  for (const receipt of Object.values(snapshot.receipts))
    for (const change of receipt.mutation.changes)
      for (const asset of [change.asset?.base, change.asset?.next]) if (asset) assets.set(canonicalJson(asset), asset);
  return [...assets.values()];
};

// Recovery proofs are authorization evidence. Content captures never include them.
export const contentSnapshot = (snapshot: Snapshot) => ({
  ...snapshot,
  receipts: Object.fromEntries(
    Object.entries(snapshot.receipts).map(([id, receipt]) => {
      const { recoveryProof: _proof, ...content } = receipt;
      return [id, content];
    }),
  ),
});
export const snapshotFingerprint = (snapshot: Snapshot) => fingerprint(contentSnapshot(snapshot));

export const captureSchema = z.strictObject({
  id: identitySchema,
  snapshot: snapshotSchema,
  snapshotHash: fingerprintSchema,
  references: z.array(z.strictObject({ scope: scopeSchema, asset: assetSchema, kind: z.enum(["asset", "package"]) })),
});
