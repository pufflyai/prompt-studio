import type { DocumentStore } from "pstdio-sync";

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
  extensionId: JSON.stringify(["pstdio.personal-history.logs-v1", input.managerOrigin, input.accountId]),
});

export const createPersonalHistoryStore = (input: {
  projectId: string;
  accountId: string;
  managerOrigin: string;
  documents: HistoryDocuments;
}) => {
  const owner = personalHistoryOwner(input);
  const records = input.documents.open("records");
  const readRecords = (kind: "sessions" | "workspaces" | "workspace_sessions") =>
    records.transaction(owner, async ({ document }) =>
      [...document.getMap<string>(kind).values()].map((value) => JSON.parse(value) as Record<string, unknown>),
    );
  return {
    owner,
    records,
    readRecords,
    async claimLocalRecords(kind: "sessions" | "workspaces", ids: string[]) {
      const localOwner = { workbenchId: input.projectId, extensionId: "pstdio.local-history-owners" };
      const identity = JSON.stringify([input.managerOrigin, input.accountId]);
      return input.documents.open("records").transaction(localOwner, async ({ document }) => {
        const owners = document.getMap<string>(kind);
        for (const id of ids) if (!owners.has(id)) owners.set(id, identity);
        return new Set(ids.filter((id) => owners.get(id) === identity));
      });
    },
    /** The relay position of each session's log, so other devices know which logs to read. */
    readHeads: () =>
      records.transaction(owner, async ({ document }) => new Map(document.getMap<number>("heads").entries())),
    writeHeads: (heads: Map<string, number>) =>
      records.transaction(owner, async ({ document }) => {
        const map = document.getMap<number>("heads");
        document.transact(() => {
          for (const [id, sequence] of heads) if ((map.get(id) ?? 0) < sequence) map.set(id, sequence);
        });
      }),
    async writeRecords<T extends { id: string }>(
      kind: "sessions" | "workspaces" | "workspace_sessions",
      device: PersonalDevice,
      rows: T[],
    ) {
      await records.transaction(owner, async ({ document }) => {
        const map = document.getMap<string>(kind);
        const ids = new Set(rows.map((row) => row.id));
        document.transact(() => {
          for (const [id, value] of map) if (!ids.has(id) && JSON.parse(value).device.id === device.id) map.delete(id);
          for (const row of rows) {
            const next = JSON.stringify({ ...row, device });
            if (map.get(row.id) !== next) map.set(row.id, next);
          }
        });
      });
    },
  };
};

export type PersonalHistoryStore = ReturnType<typeof createPersonalHistoryStore>;
