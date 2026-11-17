import { assertStorageLimits, isStorageLimitError } from "pstdio-sync-contracts";
import type { OrderedRecord } from "./ordered-operation";
import { applyOrderedOperation, projectOrderedOperation } from "./ordered-operation";
import { orderedBody } from "./ordered-projection";
import { OrderedTextCausalityError } from "./ordered-text";

// Limits measure stored content only; a revision digest per replayed save would make each
// commit cost grow with every earlier pending save of the same record.
const fits = (records: OrderedRecord[]) => {
  try {
    assertStorageLimits(
      records.map((record) => ({ recordId: record.recordId, deleted: record.deleted, ...orderedBody(record) })),
    );
    return true;
  } catch (error) {
    if (isStorageLimitError(error)) return false;
    throw error;
  }
};

/** A valid offline save can exceed limits after earlier sibling writes. Refuse it whole in that order. */
export const applyBoundedOrderedOperation = async (...args: Parameters<typeof applyOrderedOperation>) => {
  try {
    const result = applyOrderedOperation(...args);
    if (fits(result.records)) return result;
    return { decision: { ...result.decision, state: "refused" as const }, records: [], skipped: [] };
  } catch (error) {
    if (!(error instanceof OrderedTextCausalityError)) throw error;
    return {
      decision: {
        epoch: args[2],
        operationId: args[1].operationId,
        fingerprint: args[1].fingerprint,
        state: "refused" as const,
      },
      records: [],
      skipped: [],
    };
  }
};

/** Optimism cannot prevent receiving a valid canonical save or expose an oversized merged value. */
export const projectBoundedOrderedOperation = async (...args: Parameters<typeof projectOrderedOperation>) => {
  try {
    const records = projectOrderedOperation(...args);
    return fits(records) ? records : [];
  } catch (error) {
    if (error instanceof OrderedTextCausalityError) return [];
    throw error;
  }
};
