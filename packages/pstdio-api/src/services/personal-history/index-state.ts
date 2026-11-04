import { z } from "zod";
import { historyNamespace, type SessionLogFiles } from "./log-files";

export const indexEntrySchema = z.object({
  kind: z.enum(["sessions", "workspaces", "workspace_sessions", "queues", "heads", "publications"]),
  id: z.string(),
  value: z.record(z.string(), z.unknown()).nullable(),
});
export type IndexEntry = z.infer<typeof indexEntrySchema>;
export type IndexKind = Exclude<IndexEntry["kind"], "heads" | "publications">;
export const indexFile = (deviceId: string) => `index-${deviceId}`;
export const indexLogName = (deviceId: string) =>
  JSON.stringify(["pstdio.personal-history", "device-index-v1", deviceId]);

/** Materialized rows are local plain values. Only a device's changed rows cross the wire. */
export const createIndexState = (files: SessionLogFiles, namespace: string) => {
  const devices = new Map<string, Map<string, IndexEntry>>();
  const positions = new Map<string, number>();
  const cached = new Map<IndexEntry["kind"], IndexEntry[]>();
  const pending = new Map<string, Map<string, IndexEntry>>();
  let visibleRevision = {};
  const apply = (deviceId: string, entries: IndexEntry[]) => {
    const rows = devices.get(deviceId) ?? new Map<string, IndexEntry>();
    devices.set(deviceId, rows);
    for (const entry of entries) {
      if (entry.kind !== "heads" && entry.kind !== "publications") visibleRevision = {};
      cached.delete(entry.kind);
      const key = JSON.stringify([entry.kind, entry.id]);
      if (entry.value) rows.set(key, entry);
      else rows.delete(key);
    }
  };
  const loaded = (async () => {
    for (const file of await files.indexDevices(namespace)) {
      const deviceId = file.slice("index-".length);
      for (const page of await files.indexPages(namespace, file)) {
        apply(
          deviceId,
          page.lines.map((line) => indexEntrySchema.parse(JSON.parse(line))),
        );
        positions.set(deviceId, page.after);
      }
    }
  })();
  return {
    loaded,
    devices,
    positions,
    pending,
    get visibleRevision() {
      return visibleRevision;
    },
    apply,
    async save(deviceId: string, after: number, entries: IndexEntry[]) {
      await files.savePage(
        namespace,
        indexFile(deviceId),
        after,
        entries.map((entry) => JSON.stringify(entry)),
      );
      apply(
        deviceId,
        entries.filter((entry) => {
          const local = pending.get(deviceId)?.get(JSON.stringify([entry.kind, entry.id]));
          return !local || local === entry || JSON.stringify(local) === JSON.stringify(entry);
        }),
      );
      positions.set(deviceId, after);
    },
    async read(kind: IndexEntry["kind"]) {
      await loaded;
      let rows = cached.get(kind);
      if (!rows) {
        rows = [...devices.values()].flatMap((rows) => [...rows.values()].filter((entry) => entry.kind === kind));
        cached.set(kind, rows);
      }
      return rows;
    },
    async write(deviceId: string, entries: IndexEntry[]) {
      await loaded;
      const rows = devices.get(deviceId);
      for (const entry of entries) {
        const key = JSON.stringify([entry.kind, entry.id]);
        if (JSON.stringify(rows?.get(key)?.value ?? null) === JSON.stringify(entry.value)) continue;
        let queued = pending.get(deviceId);
        if (!queued) {
          queued = new Map();
          pending.set(deviceId, queued);
        }
        queued.set(key, entry);
      }
      apply(deviceId, entries);
    },
  };
};

const states = new WeakMap<SessionLogFiles, Map<string, ReturnType<typeof createIndexState>>>();
export const personalIndexState = (input: {
  files: SessionLogFiles;
  projectId: string;
  accountId: string;
  managerOrigin: string;
}) => {
  let namespaces = states.get(input.files);
  if (!namespaces) {
    namespaces = new Map();
    states.set(input.files, namespaces);
  }
  const namespace = historyNamespace(input);
  let state = namespaces.get(namespace);
  if (!state) {
    state = createIndexState(input.files, namespace);
    namespaces.set(namespace, state);
  }
  return state;
};
