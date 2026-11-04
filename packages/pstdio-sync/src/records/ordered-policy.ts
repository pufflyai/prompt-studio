import { assertStorageLimits, isStorageLimitError } from "pstdio-sync-contracts";
import { applyOrderedOperation, projectOrderedOperation } from "./ordered-operation";
import { orderedProjection } from "./ordered-projection";
import { OrderedTextCausalityError } from "./ordered-text";

const fits = async (records: Parameters<typeof orderedProjection>[0][]) => {
  try {
    assertStorageLimits(await Promise.all(records.map(orderedProjection)));
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
    if (await fits(result.records)) return result;
    return { decision: { ...result.decision, state: "refused" as const }, records: [] };
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
    };
  }
};

/** Optimism cannot prevent receiving a valid canonical save or expose an oversized merged value. */
export const projectBoundedOrderedOperation = async (...args: Parameters<typeof projectOrderedOperation>) => {
  try {
    const records = projectOrderedOperation(...args);
    return (await fits(records)) ? records : [];
  } catch (error) {
    if (error instanceof OrderedTextCausalityError) return [];
    throw error;
  }
};
