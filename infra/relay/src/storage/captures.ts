import { and, eq } from "drizzle-orm";
import {
  fingerprint,
  publishedExtensionsId,
  type Snapshot,
  snapshotAssets,
  snapshotFingerprint,
  validatePublicationRecord,
} from "pstdio-sync-contracts";
import type { RelayTransaction } from "./database";
import { relayCaptures, relayRecords } from "./schema";

export const captureSnapshot = async (transaction: RelayTransaction, ownerId: string, snapshot: Snapshot) => {
  const references = snapshotAssets(snapshot).map((asset) => ({
    scope: snapshot.scope,
    asset,
    kind: "asset" as "asset" | "package",
  }));
  const catalogScope = { ...snapshot.scope, extensionId: publishedExtensionsId };
  const [row] = await transaction
    .select()
    .from(relayRecords)
    .where(
      and(eq(relayRecords.ownerId, await fingerprint(catalogScope)), eq(relayRecords.id, snapshot.scope.extensionId)),
    );
  if (row) {
    const publication = validatePublicationRecord(row.record);
    if (publication) {
      if (publication.revision !== snapshot.publishedRevision) throw new Error("Publication capture changed");
      references.push({ scope: catalogScope, asset: row.record.asset!, kind: "package" });
    }
  }
  if (snapshot.scope.extensionId === publishedExtensionsId)
    for (const reference of references) reference.kind = "package";
  const capture = { id: crypto.randomUUID(), snapshot, snapshotHash: await snapshotFingerprint(snapshot), references };
  await transaction
    .insert(relayCaptures)
    .values({ id: capture.id, ownerId, snapshotHash: capture.snapshotHash, references });
  return capture;
};
