import type { DocumentStore } from "pstdio-sync";
import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { createPersonalIndexLog } from "./index-log";
import type { SessionLogFiles } from "./log-files";
import { type SessionLogPublication, sessionLogPublicationSchema } from "./log-publication";

export interface PersonalDevice {
  ownerId: string;
  id: string;
  name: string;
}
export interface HistoryDocuments {
  open(name: string): DocumentStore;
}
export interface PersonalHistoryInput {
  projectId: string;
  accountId: string;
  managerOrigin: string;
  documents: HistoryDocuments;
  index: RouteDeps["extensionStorageService"]["personalHistoryIndex"];
  logs: RouteDeps["extensionStorageService"]["logs"];
  files?: SessionLogFiles;
}
export const personalHistoryOwner = (
  input: Pick<PersonalHistoryInput, "projectId" | "accountId" | "managerOrigin">,
) => ({
  workbenchId: input.projectId,
  extensionId: JSON.stringify(["pstdio.personal-history.logs-v2", input.managerOrigin, input.accountId]),
});
export const legacyPersonalHistoryOwner = (
  input: Pick<PersonalHistoryInput, "projectId" | "accountId" | "managerOrigin">,
) => ({
  workbenchId: input.projectId,
  extensionId: JSON.stringify(["pstdio.personal-history.logs-v1", input.managerOrigin, input.accountId]),
});

/** The public read contract stays stable; only device logs own synchronized index data. */
const createStore = (input: PersonalHistoryInput) => {
  const owner = personalHistoryOwner(input);
  const records = input.documents.open("records");
  const index = createPersonalIndexLog(input, owner, records);
  const claims = new Map<string, boolean>();
  const readRecords = async (kind: "sessions" | "workspaces" | "workspace_sessions" | "queues") => {
    await index.ready();
    return input.index.read(owner, kind);
  };
  return {
    querySessions: async (
      ...args: Parameters<PersonalHistoryInput["index"]["querySessions"]> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => {
      await index.ready();
      return input.index.querySessions(owner, ...args);
    },
    queryWorkspaces: async (
      ...args: Parameters<PersonalHistoryInput["index"]["queryWorkspaces"]> extends [unknown, ...infer Rest]
        ? Rest
        : never
    ) => {
      await index.ready();
      return input.index.queryWorkspaces(owner, ...args);
    },
    owner,
    records,
    readRecords,
    synchronizeIndex: index.synchronizeIndex,
    indexPending: () => input.logs.pending(owner),
    visibleRevision: async () => {
      await index.ready();
      return input.index.visibleRevision(owner);
    },
    getRecord: async (kind: Parameters<typeof readRecords>[0], id: string) => {
      await index.ready();
      return (await input.index.get(owner, kind, id)) ?? null;
    },
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
    async readHeads() {
      await index.ready();
      return new Map((await input.index.read(owner, "heads")).map((row) => [String(row.id), Number(row.sequence)]));
    },
    async readPublication(id: string) {
      await index.ready();
      const row = await input.index.get(owner, "publications", id);
      return row ? sessionLogPublicationSchema.parse(row) : null;
    },
    async logSource(id: string) {
      await index.ready();
      const session = await input.index.get(owner, "sessions", id);
      const head = await input.index.get(owner, "heads", id);
      return {
        writerId: (session?.device as PersonalDevice | undefined)?.id,
        format: head?.format === "append-log-v1" ? ("append-log-v1" as const) : undefined,
      };
    },
    async writeHeads(
      heads: Map<string, number>,
      publications = new Map<string, SessionLogPublication>(),
      formats = new Map<string, "append-log-v1">(),
    ) {
      await index.ready();
      const deviceId = await input.logs.writerId();
      const seededHeads = await input.index.seeded(owner, "heads", deviceId);
      const seededPublications = await input.index.seeded(owner, "publications", deviceId);
      const changes: Parameters<typeof index.write>[0][] = [];
      for (const [id, sequence] of heads) {
        const previous = await input.index.get(owner, "heads", id);
        const format = formats.get(id);
        if (Number(previous?.sequence ?? 0) < sequence || previous?.format !== format || seededHeads.has(id))
          changes.push({
            deviceId,
            kind: "heads",
            id,
            value: JSON.parse(JSON.stringify({ id, sequence, format })) as Json,
          });
      }
      for (const [id, publication] of publications) {
        const value = { id, ...publication };
        const previous = await input.index.get(owner, "publications", id);
        if (!previous || seededPublications.has(id) || canonicalJson(previous as Json) !== canonicalJson(value))
          changes.push({ deviceId, kind: "publications", id, value });
      }
      await index.writeMany(changes);
    },
    async patchRecords<T extends { id: string }>(
      kind: "sessions" | "workspaces" | "workspace_sessions" | "queues",
      device: PersonalDevice,
      rows: T[],
      removed: string[] = [],
    ) {
      await index.ready();
      const changes: Parameters<typeof index.write>[0][] = [];
      const seen = new Map<string, Json>();
      for (const row of rows) {
        const value = JSON.parse(JSON.stringify({ ...row, device })) as Json;
        const old = seen.has(row.id) ? seen.get(row.id) : await input.index.get(owner, kind, row.id);
        if (
          !old ||
          (await input.index.isSeeded(owner, kind, device.id, row.id)) ||
          canonicalJson(old as Json) !== canonicalJson(value)
        )
          changes.push({ deviceId: device.id, kind, id: row.id, value });
        seen.set(row.id, value);
      }
      for (const id of removed) changes.push({ deviceId: device.id, kind, id, value: null });
      await index.writeMany(changes);
    },
    async writeRecords<T extends { id: string }>(
      kind: Parameters<typeof readRecords>[0],
      device: PersonalDevice,
      rows: T[],
    ) {
      await index.ready();
      const next = new Set(rows.map((row) => row.id));
      const removed = (await input.index.device(owner, kind, device.id))
        .map((row) => String(row.id))
        .filter((id) => !next.has(id));
      await this.patchRecords(kind, device, rows, removed);
    },
  };
};
const stores = new WeakMap<PersonalHistoryInput["index"], Map<string, ReturnType<typeof createStore>>>();
export const createPersonalHistoryStore = (input: PersonalHistoryInput) => {
  let owners = stores.get(input.index);
  if (!owners) {
    owners = new Map();
    stores.set(input.index, owners);
  }
  const key = JSON.stringify(personalHistoryOwner(input));
  let store = owners.get(key);
  if (!store) {
    store = createStore(input);
    owners.set(key, store);
  }
  return store;
};
export type PersonalHistoryStore = ReturnType<typeof createPersonalHistoryStore>;
