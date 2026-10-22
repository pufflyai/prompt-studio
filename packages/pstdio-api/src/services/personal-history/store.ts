import { type SessionMessage, sessionMessageSchema } from "pstdio-api-contracts";
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
  extensionId: JSON.stringify(["pstdio.personal-history", input.managerOrigin, input.accountId]),
});

export const createPersonalHistoryStore = (input: {
  projectId: string;
  accountId: string;
  managerOrigin: string;
  documents: HistoryDocuments;
}) => {
  const owner = personalHistoryOwner(input);
  const records = input.documents.open("records");
  const transcriptName = (id: string) => JSON.stringify(["transcript", id]);
  const readRecords = (kind: "sessions" | "workspaces" | "workspace_sessions") =>
    records.transaction(owner, async ({ document }) =>
      [...document.getMap<string>(kind).values()].map((value) => JSON.parse(value) as Record<string, unknown>),
    );
  return {
    owner,
    records,
    transcript: (id: string) => input.documents.open(transcriptName(id)),
    transcriptName,
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
    transcriptNames: async () => (await readRecords("sessions")).map((row) => String(row.id)),
    async writeTranscript(id: string, messages: SessionMessage[]) {
      await input.documents.open(transcriptName(id)).transaction(owner, async ({ document }) => {
        const next = JSON.stringify(messages);
        const content = document.getText("content");
        if (content.toString() === next) return;
        document.transact(() => {
          content.delete(0, content.length);
          content.insert(0, next);
        });
      });
    },
    readTranscript: (id: string) =>
      input.documents.open(transcriptName(id)).transaction(owner, async ({ document }) => {
        const content = document.getText("content").toString();
        return content ? sessionMessageSchema.array().parse(JSON.parse(content)) : [];
      }),
  };
};

export type PersonalHistoryStore = ReturnType<typeof createPersonalHistoryStore>;
