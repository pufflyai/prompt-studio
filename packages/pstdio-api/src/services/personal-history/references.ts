import type { DocumentStore } from "pstdio-sync";
import type { PersonalDevice } from "./store";

export const historyReferenceOwner = (projectId: string) => ({
  workbenchId: projectId,
  extensionId: "pstdio.history-references",
});
export const historyReferenceName = "pstdio.history-references";
export interface HistoryReference {
  type: "session" | "workspace";
  id: string;
  device: PersonalDevice;
}

/** Shared pointers contain only opaque IDs and the owner/device, never private summaries. */
export const createHistoryReferences = (store: DocumentStore, projectId: string) => {
  const owner = historyReferenceOwner(projectId);
  const written = new Map<string, string>();
  return {
    owner,
    store,
    write: (device: PersonalDevice, refs: Omit<HistoryReference, "device">[]) =>
      store.transaction(owner, async ({ document }) => {
        const map = document.getMap<string>("references");
        const next = new Map(
          refs.map((ref) => [JSON.stringify([ref.type, ref.id]), JSON.stringify({ ...ref, device })]),
        );
        document.transact(() => {
          for (const [id, value] of map) {
            const previous = JSON.parse(value).device;
            if (previous.id === device.id && previous.ownerId === device.ownerId && !next.has(id)) map.delete(id);
          }
          for (const [id, value] of next) if (map.get(id) !== value) map.set(id, value);
        });
      }),
    async set(ref: HistoryReference) {
      const key = JSON.stringify([ref.type, ref.id]);
      const value = JSON.stringify(ref);
      if (written.get(key) === value) return;
      await store.transaction(owner, async ({ document }) => {
        const map = document.getMap<string>("references");
        if (map.get(key) !== value) map.set(key, value);
      });
      written.set(key, value);
    },
    async remove(type: string, id: string) {
      const key = JSON.stringify([type, id]);
      await store.transaction(owner, async ({ document }) => {
        document.getMap<string>("references").delete(key);
      });
      written.delete(key);
    },
    get: (type: string, id: string) =>
      store.transaction(owner, async ({ document }) => {
        const value = document.getMap<string>("references").get(JSON.stringify([type, id]));
        return value ? (JSON.parse(value) as HistoryReference) : null;
      }),
  };
};
