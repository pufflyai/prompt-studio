import type { DocumentStore } from "pstdio-sync";
import { canonicalJson, type Json } from "pstdio-sync-contracts";
import type { RouteDeps } from "../../features/deps";
import { createPersonalIndexLog } from "./index-log";
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
export const createPersonalHistoryStore = (input: PersonalHistoryInput) => {
  const owner = personalHistoryOwner(input);
  const records = input.documents.open("records");
  const index = createPersonalIndexLog(input, owner, records);
  const readRecords = async (kind: "sessions" | "workspaces" | "workspace_sessions" | "queues") => {
    await index.ready();
    return input.index.read(owner, kind);
  };
  return {
    owner,
    records,
    readRecords,
    synchronize: index.synchronize,
    async claimLocalRecords(kind: "sessions" | "workspaces", ids: string[]) {
      const localOwner = { workbenchId: input.projectId, extensionId: "pstdio.local-history-owners" };
      const identity = JSON.stringify([input.managerOrigin, input.accountId]);
      return input.documents.open("records").transaction(localOwner, async ({ document }) => {
        const owners = document.getMap<string>(kind);
        for (const id of ids) if (!owners.has(id)) owners.set(id, identity);
        return new Set(ids.filter((id) => owners.get(id) === identity));
      });
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
      for (const [id, sequence] of heads) {
        const previous = await input.index.get(owner, "heads", id);
        const format = formats.get(id);
        if (Number(previous?.sequence ?? 0) < sequence || previous?.format !== format || seededHeads.has(id))
          await index.write({
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
          await index.write({ deviceId, kind: "publications", id, value });
      }
    },
    async writeRecords<T extends { id: string }>(
      kind: "sessions" | "workspaces" | "workspace_sessions" | "queues",
      device: PersonalDevice,
      rows: T[],
    ) {
      await index.ready();
      const previous = new Map((await input.index.device(owner, kind, device.id)).map((row) => [String(row.id), row]));
      const seeded = await input.index.seeded(owner, kind, device.id);
      for (const row of rows) {
        const value = JSON.parse(JSON.stringify({ ...row, device })) as Json;
        const old = previous.get(row.id);
        if (!old || seeded.has(row.id) || canonicalJson(old as Json) !== canonicalJson(value))
          await index.write({ deviceId: device.id, kind, id: row.id, value });
        previous.delete(row.id);
      }
      for (const id of previous.keys()) await index.write({ deviceId: device.id, kind, id, value: null });
    },
  };
};
export type PersonalHistoryStore = ReturnType<typeof createPersonalHistoryStore>;
