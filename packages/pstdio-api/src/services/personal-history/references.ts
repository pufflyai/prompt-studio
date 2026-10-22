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
    get: (type: string, id: string) =>
      store.transaction(owner, async ({ document }) => {
        const value = document.getMap<string>("references").get(JSON.stringify([type, id]));
        return value ? (JSON.parse(value) as HistoryReference) : null;
      }),
  };
};
