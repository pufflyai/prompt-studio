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
export const applyOrderedStreamFrame = async (
  journal: OrderedJournal,
  tx: OrderedTransaction,
  frame: RecordFrame,
  epoch: string,
  applyGroup: Apply,
  applyNative: Apply,
) => {
  const entries = await Promise.all(frame.records.map((record) => decodeOrderedEntry(record.bytes)));
  if (entries.some((entry) => entry.type !== "admission" && entry.type !== "text"))
    throw new Error("An update must contain ordered group or text admissions");
  const changed = [];
  for (const entry of entries) {
    if (entry.type === "admission") changed.push(...(await applyGroup(journal, tx, entry.admission, epoch)));
    if (entry.type === "text") changed.push(...(await applyNative(journal, tx, entry.admission, epoch)));
  }
  return changed;
};
