import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createHostStoreRegistry, useHostStorage } from "../../utils/host-storage";

interface CreateDraft {
  values: Record<string, unknown>;
  attributeValues: Record<string, unknown>;
}

interface CreateDraftState {
  draft: CreateDraft | null;
  setDraft: (update: (draft: CreateDraft | null) => CreateDraft | null) => void;
  clearDraft: () => void;
}

// One in-memory draft per host and view/filter survives renderer remounts and retains
// File objects. Cancel and Escape suspend it; only X or successful creation clears it.
const draftStore = createHostStoreRegistry(() =>
  createStore<CreateDraftState>((set) => ({
    draft: null,
    setDraft: (update) =>
      set((state) => {
        const draft = update(state.draft);
        return draft === state.draft ? state : { draft };
      }),
    clearDraft: () => set({ draft: null }),
  })),
);

export const useKanbanCreateDraft = (key: string) => useStore(draftStore(key, useHostStorage()));
