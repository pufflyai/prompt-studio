import { and, eq } from "drizzle-orm";
import { fingerprint, publishedExtensionsId, validatePublicationRecord } from "pstdio-sync-contracts";
import type { RelayTransaction } from "./database";
import { relayRecords, relayScopes } from "./schema";

export const withPublishedRevision = async (
  transaction: RelayTransaction,
  owner: typeof relayScopes.$inferSelect,
  lock = false,
) => {
  if (owner.scope.extensionId === publishedExtensionsId) return owner;
  const catalogId = await fingerprint({ ...owner.scope, extensionId: publishedExtensionsId });
  const query = transaction.select().from(relayScopes).where(eq(relayScopes.id, catalogId));
  // Publication and handler validation have one order. Reading snapshots uses the
  // transaction's consistent view; submitting a handler holds publication still.
  if (lock) await query.for("share");
  const [row] = await transaction
    .select()
    .from(relayRecords)
    .where(and(eq(relayRecords.ownerId, catalogId), eq(relayRecords.id, owner.scope.extensionId)));
  if (!row) return owner;
  const publication = validatePublicationRecord(row.record);
  return { ...owner, publishedRevision: publication?.revision ?? "unpublished-extension" };
};
