import type { DocumentRelay } from "../relay";

/** Metadata reads remain ordered even when only selected encrypted payloads will be fetched. */
export const readLogRelayPage = async (relay: DocumentRelay, after: number) => {
  const result = await relay.read(after);
  if (result.status !== "updates") return result;
  let expected = after;
  const updates = result.updates.filter((update) => update.sequence > after);
  for (const update of updates) {
    if (update.sequence !== expected + 1) throw new Error("Log relay is missing an ordered update");
    expected = update.sequence;
  }
  if (!result.more && expected < result.lastSequence) throw new Error("Log relay is missing an ordered update");
  if (result.more && !updates.length) throw new Error("Log relay did not advance its page");
  return { ...result, updates };
};
