import type { OrderedRecord } from "pstdio-sync/records";
import type { OrderedJournal } from "./ordered-journal";

/** A relay page already has one SQL transaction and owner lock. Keep only its
 * current author group's canonical view, persisting the final values once before
 * projection/cursor publication. Each admission still records its exact decision.
 * Native text and core resource-number accounting retain their SQL-visible path. */
export const createOrderedCanonicalBatch = (journal: OrderedJournal) => {
  const known = new Set<string>();
  const views = new Map<string, OrderedRecord>();
  const dirty = new Map<string, OrderedRecord>();
  const flush = async () => {
    if (dirty.size) await journal.saveCanonical([...dirty.values()]);
    known.clear();
    views.clear();
    dirty.clear();
  };
  return {
    flush,
    journal: {
      ...journal,
      async canonical(ids: string[]) {
        if (ids.some((id) => !known.has(id))) {
          await flush();
          const loaded = await journal.canonical(ids);
          if ([...loaded.values()].some((record) => Object.keys(record.texts ?? {}).length)) return loaded;
          for (const id of ids) known.add(id);
          for (const [id, record] of loaded) views.set(id, record);
        }
        return new Map(ids.flatMap((id) => (views.has(id) ? [[id, views.get(id)!] as const] : [])));
      },
      async saveCanonical(records: OrderedRecord[]) {
        if (records.some((record) => !known.has(record.recordId) || Object.keys(record.texts ?? {}).length)) {
          await flush();
          return journal.saveCanonical(records);
        }
        for (const record of records) {
          views.set(record.recordId, record);
          dirty.set(record.recordId, record);
        }
      },
    },
  };
};
