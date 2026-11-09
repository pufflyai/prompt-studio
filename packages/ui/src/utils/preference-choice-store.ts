import { createStore } from "zustand/vanilla";

/** One selected scalar; the existing adapter remains the persistence authority. */
export const createPreferenceChoiceStore = (
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  initial?: string,
) => {
  const state = createStore<string | null>(() => initial ?? storage.getItem(key));
  const update = (next: string | null) => state.setState(next, true);
  return {
    getSnapshot: state.getState,
    subscribe: state.subscribe,
    update,
    setChoice(next: string) {
      update(next);
      storage.setItem(key, next);
    },
  };
};
