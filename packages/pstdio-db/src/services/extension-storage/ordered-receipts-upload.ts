import type { StorageOwner } from "pstdio-sync";
import type { OrderedOperation } from "pstdio-sync/records";
import type { createOrderedReceiptIndex } from "pstdio-sync/relay";
import { encodeOrderedEntry, recordFrameCost } from "pstdio-sync/relay";
import { assetSchema } from "pstdio-sync-contracts";
import type { OrderedJournal } from "./ordered-journal";
import { isOrderedNativeRequest } from "./ordered-native-identity";
import { pendingOrderedOperations } from "./ordered-pending";
import { prepareOrderedAdmission, rebaseOrderedProjection } from "./ordered-rebase";
import { createOrderedReceiptResolver } from "./ordered-receipts-resolver";
import { receiptRoots } from "./ordered-receipts-state";
import { evaluateOrderedReturn } from "./ordered-return-review";
import type { OrderedTransaction } from "./ordered-sql";
import { readOrderedOwner } from "./ordered-stream-state";

const authoredAssets = async (journal: OrderedJournal, operation: OrderedOperation) => {
  // Retain immutable file intent even if its local projection is hidden by a condition/tombstone.
  const assets = operation.edits.flatMap((edit) =>
    edit.changes.flatMap((change) => {
      if (!("set" in change)) return [];
      let value = change.set;
      if (!change.path.length && value && typeof value === "object" && !Array.isArray(value))
        value = value.asset ?? null;
      else if (change.path.length !== 1 || change.path[0] !== "asset") return [];
      return value === null ? [] : [assetSchema.parse(value)];
    }),
  );
  const restored = operation.edits.filter((edit) => edit.deleted === false).map((edit) => edit.recordId);
  for (const record of (await journal.canonical(restored)).values()) {
    const body = record.value as { asset?: unknown };
    if (body.asset) assets.push(assetSchema.parse(body.asset));
  }
  return assets;
};
export const nextOrderedUpload = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  owner: StorageOwner,
  index: ReturnType<typeof createOrderedReceiptIndex>,
  limit: number,
) => {
  const row = await readOrderedOwner(tx, owner);
  if (!row.epoch) return [];
  // A returning device decides here, once connected, whether its changes upload or wait for review.
  if ((await evaluateOrderedReturn(journal, tx, owner)) === "held") return [];
  const resolver = createOrderedReceiptResolver(journal, receiptRoots(row.receipt_root).root, index);
  const uploads = [];
  let bytes = 0;
  for await (const local of pendingOrderedOperations(journal)) {
    if (await resolver.reconcile(local, row.epoch)) {
      await rebaseOrderedProjection(
        journal,
        tx,
        owner,
        local.operation.edits.map((edit) => edit.recordId),
      );
      continue;
    }
    const known = await resolver.availableDependencies(local.operation, row.epoch);
    // Foreign editor context may arrive before its author uploads the parent group. A ready
    // independent save can still order, breaking that cross-device wait without publishing the child.
    if (!known) continue;
    const admission =
      local.admission?.epoch === row.epoch
        ? local.admission
        : await prepareOrderedAdmission(journal, local.operation, row.epoch, known);
    const entry = {
      sequence: local.sequence,
      records: [
        encodeOrderedEntry({
          type: isOrderedNativeRequest(local.requestFingerprint) ? "text" : "admission",
          admission,
        }),
      ],
      assets: await authoredAssets(journal, local.operation),
    };
    const cost = entry.records.reduce((total, record) => total + recordFrameCost(record.recordId, record.bytes), 0);
    // Keep a large first save whole for the transport's existing blob fallback.
    if (uploads.length && bytes + cost > limit) break;
    uploads.push(entry);
    bytes += cost;
    if (bytes >= limit) break;
  }
  return uploads;
};
