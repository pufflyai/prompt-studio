import type { ExtensionLogApi, StorageLogDefinition } from "pstdio-api-contracts/extension-kernel";
import type { LogReceivedBatch } from "pstdio-sync/logs";
import { createLogCollection, createMemoryLogStore, type LogDirectoryEntry } from "pstdio-sync/logs";

interface MemoryLogPeer {
  directory(): LogDirectoryEntry[];
  catalog(entries: LogDirectoryEntry[]): void;
  ensure(entry: LogDirectoryEntry): ReturnType<typeof createMemoryLogStore>;
}
const key = (entry: LogDirectoryEntry) => JSON.stringify([entry.name, entry.scope, entry.stream]);
type Rows = Awaited<ReturnType<ReturnType<typeof createMemoryLogStore>["dump"]>>;
const prepareMerge = (rows: Rows) => {
  const ordered = rows
    .filter((row) => row.sequence !== null)
    .sort((a, b) => a.sequence! - b.sequence! || a.index - b.index);
  const known = new Map<string, (typeof ordered)[number]>();
  for (const row of ordered) if (!known.has(row.entry.id)) known.set(row.entry.id, row);
  const head = Math.max(0, ...[...known.values()].map((row) => row.sequence!));
  const grouped = new Map<number, LogReceivedBatch>();
  for (const row of known.values()) {
    const batch = grouped.get(row.sequence!) ?? { sequence: row.sequence!, entries: [] };
    while (batch.entries.length <= row.index) batch.entries.push(null);
    batch.entries[row.index] = row.entry;
    grouped.set(row.sequence!, batch);
  }
  const batches = [...grouped.values()];

  return { known, head, batches };
};
export const createMemoryLogs = (input: {
  workbenchId: string;
  extensionId: string;
  writerId: string;
  definitions?: readonly (string | StorageLogDefinition)[];
}) => {
  const catalog = new Map<string, LogDirectoryEntry>();
  const stores = new Map<string, ReturnType<typeof createMemoryLogStore>>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const ensure = (entry: LogDirectoryEntry) => {
    const address = key(entry);
    let value = stores.get(address);
    if (!value) {
      value = createMemoryLogStore({
        address: JSON.stringify([input.workbenchId, input.extensionId, address]),
        writerId: input.writerId,
        keep: entry.keep,
        changed,
      });
      stores.set(address, value);
    }
    return value;
  };
  const peer: MemoryLogPeer = {
    directory: () => [...catalog.values()].map((entry) => structuredClone(entry)),
    catalog: (entries) => {
      for (const entry of entries) catalog.set(key(entry), structuredClone(entry));
    },
    ensure,
  };
  return {
    ...peer,
    open(name: string, scope: string): ExtensionLogApi {
      const declared = input.definitions?.find((entry) => (typeof entry === "string" ? entry : entry.name) === name);
      if (!declared) throw new Error(`Log is not declared: ${name}`);
      const definition =
        typeof declared === "string"
          ? { name: declared, writer: "project" as const }
          : { ...declared, writer: declared.writer ?? "project" };
      return createLogCollection({
        address: JSON.stringify([input.workbenchId, input.extensionId, name, scope]),
        definition,
        scope,
        writerId: async () => input.writerId,
        directory: async () => peer.directory(),
        register: async (entry) => {
          peer.catalog([entry]);
        },
        open: async (entry) => ensure(entry).store,
        remote: async () => undefined,
        watch: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      });
    },
    async merge(other: MemoryLogPeer) {
      const directory = [
        ...new Map([...peer.directory(), ...other.directory()].map((entry) => [key(entry), entry])).values(),
      ];
      peer.catalog(directory);
      other.catalog(directory);
      for (const entry of directory) {
        const left = ensure(entry);
        const right = other.ensure(entry);
        const a = await left.dump();
        const b = await right.dump();
        const prepared = prepareMerge([...a, ...b]);
        const { known, batches } = prepared;
        let { head } = prepared;
        for (const row of [...a, ...b].filter((row) => row.local && row.sequence === null)) {
          if (known.has(row.entry.id)) continue;
          known.set(row.entry.id, row);
          batches.push({ sequence: ++head, entries: [row.entry] });
        }
        batches.sort((a, b) => a.sequence - b.sequence);
        await left.store.receive(batches, head, { from: 0 });
        await right.store.receive(batches, head, { from: 0 });
      }
    },
  };
};
