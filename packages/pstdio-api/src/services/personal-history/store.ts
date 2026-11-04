import type { DocumentStore } from "pstdio-sync";
import { type IndexKind, personalIndexState } from "./index-state";
import { createIndexSync } from "./index-sync";
import { historyNamespace, type SessionLogFiles } from "./log-files";
import { type SessionLogPublication, sessionLogPublicationSchema } from "./log-publication";

export interface PersonalDevice {
  ownerId: string;
  id: string;
  name: string;
}

export interface HistoryDocuments {
  open(name: string): DocumentStore;
}

export const personalHistoryOwner = (input: { projectId: string; accountId: string; managerOrigin: string }) => ({
  workbenchId: input.projectId,
  extensionId: JSON.stringify(["pstdio.personal-history.index-v1", input.managerOrigin, input.accountId]),
});

const createStore = (input: {
  projectId: string;
  accountId: string;
  managerOrigin: string;
  documents: HistoryDocuments;
  files: SessionLogFiles;
}) => {
  const owner = personalHistoryOwner(input);
  const records = input.documents.open("records");
  const index = personalIndexState(input);
  const readRecords = async (kind: IndexKind) => (await index.read(kind)).map((entry) => entry.value!);
  const synchronizeIndex = createIndexSync(index);
  const claims = new Map<string, boolean>();
  return {
    owner,
    records,
    readRecords,
    async visibleRevision() {
      await index.loaded;
      return index.visibleRevision;
    },
    async getRecord(kind: IndexKind, id: string) {
      await index.loaded;
      const key = JSON.stringify([kind, id]);
      for (const rows of index.devices.values()) {
        const entry = rows.get(key);
        if (entry) return entry.value;
      }
      return null;
    },
    synchronizeIndex,
    indexPending: () => index.pending.size > 0,
    async registerDevice(id: string) {
      await records.transaction(owner, async ({ document }) => {
        const devices = document.getMap<boolean>("devices");
        if (!devices.has(id)) devices.set(id, true);
      });
    },
    devices: () => records.transaction(owner, async ({ document }) => [...document.getMap<boolean>("devices").keys()]),
    async claimLocalRecords(kind: "sessions" | "workspaces", ids: string[]) {
      const localOwner = { workbenchId: input.projectId, extensionId: "pstdio.local-history-owners" };
      const identity = JSON.stringify([input.managerOrigin, input.accountId]);
      const unknown = ids.filter((id) => !claims.has(JSON.stringify([kind, id])));
      if (unknown.length) {
        const found = await input.documents.open("records").transaction(localOwner, async ({ document }) => {
          const owners = document.getMap<string>(kind);
          for (const id of unknown) if (!owners.has(id)) owners.set(id, identity);
          return unknown.map((id) => [JSON.stringify([kind, id]), owners.get(id) === identity] as const);
        });
        for (const [key, own] of found) claims.set(key, own);
      }
      return new Set(ids.filter((id) => claims.get(JSON.stringify([kind, id]))));
    },
    /** Heads share their device's incremental index log. */
    readHeads: async () =>
      new Map((await index.read("heads")).map((entry) => [entry.id, Number(entry.value!.sequence)])),
    async readPublication(id: string) {
      const entry = (await index.read("publications")).find((entry) => entry.id === id);
      return entry?.value ? sessionLogPublicationSchema.parse(entry.value) : null;
    },
    async writeHeads(heads: Map<string, number>, publications = new Map<string, SessionLogPublication>()) {
      const sessions = new Map((await readRecords("sessions")).map((row) => [row.id, row]));
      for (const id of new Set([...heads.keys(), ...publications.keys()])) {
        const sequence = heads.get(id);
        const session = sessions.get(id);
        if (!session) continue;
        const entries = [];
        if (sequence !== undefined) entries.push({ kind: "heads" as const, id, value: { sequence } });
        const publication = publications.get(id);
        if (publication) entries.push({ kind: "publications" as const, id, value: publication });
        await index.write((session.device as PersonalDevice).id, entries);
      }
    },
    async patchRecords<T extends { id: string }>(
      kind: IndexKind,
      device: PersonalDevice,
      rows: T[],
      removed: string[] = [],
    ) {
      await index.write(device.id, [
        ...removed.map((id) => ({ kind, id, value: null })),
        ...rows.map((row) => ({ kind, id: row.id, value: { ...row, device } })),
      ]);
    },
    async writeRecords<T extends { id: string }>(kind: IndexKind, device: PersonalDevice, rows: T[]) {
      await index.loaded;
      const previous = [...(index.devices.get(device.id)?.values() ?? [])].filter((entry) => entry.kind === kind);
      const ids = new Set(rows.map((row) => row.id));
      await index.write(device.id, [
        ...previous.filter((entry) => !ids.has(entry.id)).map((entry) => ({ ...entry, value: null })),
        ...rows.map((row) => ({ kind, id: row.id, value: { ...row, device } })),
      ]);
    },
  };
};

const stores = new WeakMap<SessionLogFiles, Map<string, ReturnType<typeof createStore>>>();
export const createPersonalHistoryStore = (input: Parameters<typeof createStore>[0]) => {
  let namespaces = stores.get(input.files);
  if (!namespaces) {
    namespaces = new Map();
    stores.set(input.files, namespaces);
  }
  const namespace = historyNamespace(input);
  let store = namespaces.get(namespace);
  if (!store) {
    store = createStore(input);
    namespaces.set(namespace, store);
  }
  return store;
};

export type PersonalHistoryStore = ReturnType<typeof createPersonalHistoryStore>;
