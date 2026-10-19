import {
  canonicalJson,
  publishedExtensionsId,
  type RelayBackupScope,
  type Scope,
  snapshotFingerprint,
  snapshotRecoveryAssets,
  validateMutation,
  validatePublicationRecord,
} from "pstdio-sync-contracts";
import { copyKey, type createBackupObjects } from "./objects";

export const verifyCapture = async (
  manifest: RelayBackupScope,
  scope: Scope,
  objects: ReturnType<typeof createBackupObjects>,
  verified: Set<string>,
  signal?: AbortSignal,
) => {
  const snapshot = manifest.capture.snapshot;
  const scopeId = canonicalJson(scope);
  if (
    canonicalJson(snapshot.scope) !== scopeId ||
    manifest.capture.snapshotHash !== (await snapshotFingerprint(snapshot))
  )
    throw new Error("Backup snapshot coverage mismatch");
  for (const receipt of Object.values(snapshot.receipts)) {
    await validateMutation(receipt.mutation);
    if (receipt.recoveryProof || canonicalJson(receipt.mutation.scope) !== scopeId)
      throw new Error("Backup contains authorization evidence or foreign receipts");
  }
  const required = new Set(snapshotRecoveryAssets(snapshot).map((asset) => canonicalJson(asset)));
  for (const reference of manifest.capture.references) {
    if (canonicalJson(reference.scope) === scopeId) required.delete(canonicalJson(reference.asset));
    if (
      reference.scope.accountId !== snapshot.scope.accountId ||
      reference.scope.workbenchId !== snapshot.scope.workbenchId
    )
      throw new Error("Backup reference belongs to another owner");
    const key = await copyKey(reference.asset);
    if (!verified.has(key)) await objects.verify(key, reference.asset, signal);
    verified.add(key);
  }
  if (required.size) throw new Error("Backup recovery references are incomplete");
};
export const verifyPublication = (manifest: RelayBackupScope, manifests: RelayBackupScope[]) => {
  const snapshot = manifest.capture.snapshot;
  if (snapshot.scope.extensionId === publishedExtensionsId) return;
  const scopeId = canonicalJson({ ...snapshot.scope, extensionId: publishedExtensionsId });
  const catalog = manifests.find((entry) => canonicalJson(entry.capture.snapshot.scope) === scopeId);
  const record = catalog?.capture.snapshot.records[snapshot.scope.extensionId];
  if (!record) return;
  const publication = validatePublicationRecord(record);
  if (!publication) return;
  const copied = manifest.capture.references.some(
    (reference) =>
      reference.kind === "package" &&
      reference.asset.sha256 === publication.revision &&
      canonicalJson(reference.scope) === scopeId,
  );
  if (!copied || snapshot.publishedRevision !== publication.revision)
    throw new Error("Backup publication package is incomplete");
};
