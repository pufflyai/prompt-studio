import type { StorageOwner } from "pstdio-sync";
import { coreOwnerId, type OrderedRecord } from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";
import type { OrderedPublicationBaseline } from "./ordered-record-publication";

/** Within the owner transaction, keep the current group's canonical state until the
 * next group needs it in SQL or projection can publish it with the visible state. */
export const createOrderedCanonicalBatch = (
  journal: OrderedJournal,
  options: { writeThrough?: boolean; capturePrevious?: boolean } = {},
) => {
  const known = new Set<string>();
  const views = new Map<string, OrderedRecord>();
  const dirty = new Map<string, OrderedRecord>();
  const previous: OrderedPublicationBaseline = new Map();
  const clear = () => {
    known.clear();
    views.clear();
    previous.clear();
  };
  const flush = async () => {
    if (dirty.size) await journal.saveCanonical([...dirty.values()]);
    dirty.clear();
    clear();
  };
  const copyPrevious = (ids: string[], baseline?: OrderedPublicationBaseline) => {
    if (baseline) for (const id of ids) if (previous.has(id)) baseline.set(id, previous.get(id)!);
  };
  return {
    flush,
    staged: dirty as ReadonlyMap<string, OrderedRecord>,
    previous,
    journal: {
      ...journal,
      forgetCanonicalReads() {
        if (dirty.size) throw new Error("Publish staged canonical records before invalidating their reads");
        clear();
        journal.forgetCanonicalReads?.();
      },
      async canonical(ids: string[], baseline?: OrderedPublicationBaseline) {
        if (ids.some((id) => !known.has(id))) {
          await flush();
          const loaded = await journal.canonical(ids, baseline || options.capturePrevious ? previous : undefined);
          copyPrevious(ids, baseline);
          if ([...loaded.values()].some((record) => Object.keys(record.texts ?? {}).length)) return loaded;
          for (const id of ids) known.add(id);
          for (const [id, record] of loaded) views.set(id, record);
        } else copyPrevious(ids, baseline);
        return new Map(ids.flatMap((id) => (views.has(id) ? [[id, views.get(id)!] as const] : [])));
      },
      async saveCanonical(records: OrderedRecord[]) {
        if (records.some((record) => !known.has(record.recordId) || Object.keys(record.texts ?? {}).length)) {
          await flush();
          return journal.saveCanonical(records);
        }
        // Authored commits still publish every canonical write immediately. Their
        // compilation and settlement only share reads within this one owner transaction.
        if (options.writeThrough) await journal.saveCanonical(records);
        for (const record of records) {
          views.set(record.recordId, record);
          if (!options.writeThrough) dirty.set(record.recordId, record);
        }
      },
    },
  };
};

/** Core number accounting reads canonical SQL directly; extension commits reuse only their own group's reads. */
export const createOrderedCommitJournal = (journal: OrderedJournal, owner: StorageOwner) =>
  owner.extensionId === coreOwnerId
    ? journal
    : createOrderedCanonicalBatch(journal, { writeThrough: true, capturePrevious: true }).journal;
