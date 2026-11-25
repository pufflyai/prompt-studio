import type { OrderedAdmission } from "pstdio-sync/records";
import { decodeOrderedEntry, type RecordFrame } from "pstdio-sync/relay";
import type { OrderedJournal } from "./ordered-journal";
import type { OrderedTransaction } from "./ordered-sql";

type Apply = (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  admission: OrderedAdmission,
  epoch: string,
) => Promise<string[]>;

/** Verify each frame once and set aside frames with a non-admission entry as a whole. */
export const decodeOrderedStreamFrame = async (frame: RecordFrame | null) => {
  if (!frame) return;
  const entries = await Promise.all(frame.records.map((record) => decodeOrderedEntry(record.bytes)));
  if (entries.every((entry) => entry.type === "admission" || entry.type === "text")) return entries;
};

export const applyOrderedStreamFrame = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  entries: NonNullable<Awaited<ReturnType<typeof decodeOrderedStreamFrame>>>,
  epoch: string,
  applyGroup: Apply,
  applyNative: Apply,
) => {
  const changed = [];
  for (const entry of entries) {
    if (entry.type === "admission") changed.push(...(await applyGroup(journal, tx, entry.admission, epoch)));
    if (entry.type === "text") changed.push(...(await applyNative(journal, tx, entry.admission, epoch)));
  }
  return changed;
};
