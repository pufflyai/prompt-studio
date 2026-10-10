import { useStore } from "zustand";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import {
  createHostPersistStorage,
  createHostStoreRegistry,
  type HostStorage,
  useHostStorage,
} from "../../utils/host-storage";

interface CreatePreference {
  openCreatedRow: boolean;
  setOpenCreatedRow: (value: boolean) => void;
}

const preferenceKey = "pstdio/ui/kanban-renderer/create-preference";

export const createKanbanCreatePreferenceStore = (storage?: HostStorage) =>
  createStore<CreatePreference>()(
    persist((set) => ({ openCreatedRow: true, setOpenCreatedRow: (openCreatedRow) => set({ openCreatedRow }) }), {
      name: preferenceKey,
      storage: createHostPersistStorage(storage),
      partialize: ({ openCreatedRow }) => ({ openCreatedRow }),
    }),
  );

const preferenceStore = createHostStoreRegistry((_key, storage) => createKanbanCreatePreferenceStore(storage));

export const useKanbanCreatePreference = () => useStore(preferenceStore(preferenceKey, useHostStorage()));
